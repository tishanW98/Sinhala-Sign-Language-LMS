# app.py
import asyncio
import json
import io
import uuid
from collections import deque, defaultdict

import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from tensorflow.keras.models import load_model
import uvicorn

# ---------- Config ----------
MODEL_PATH = "best_model.h5"
ACTIONS_PATH = "actions.npy"
SEQUENCE_LENGTH = 40       # MUST match your training SEQUENCE_LENGTH
THRESHOLD = 0.6
SMOOTHING_WINDOW = 12

# ---------- FastAPI setup ----------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000",
                   "http://127.0.0.1:8000"],  # add your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files (so the page is available from the same origin)
# This allows navigator.mediaDevices and WebSocket to work without insecure-origin issues.
app.mount("/", StaticFiles(directory=".", html=True), name="static")

# ---------- Load model + actions ----------
model = load_model(MODEL_PATH)
actions = np.load(ACTIONS_PATH).tolist()
print("Actions loaded:", actions)

# ---------- Mediapipe helpers ----------
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_face_mesh = mp.solutions.face_mesh

FACE_IDX = [0, 13, 14, 17, 61, 291]


def mediapipe_process_frame(cv_image, holistic):
    # cv_image is BGR
    image_rgb = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False
    results = holistic.process(image_rgb)
    image_rgb.flags.writeable = True
    return results


def extract_keypoints(results):
    pose = np.array([[res.x, res.y, res.z, res.visibility]
                     for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*4)

    if results.face_landmarks:
        face = np.array([[results.face_landmarks.landmark[i].x,
                          results.face_landmarks.landmark[i].y,
                          results.face_landmarks.landmark[i].z] for i in FACE_IDX]).flatten()
    else:
        face = np.zeros(len(FACE_IDX) * 3)

    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten(
    ) if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten(
    ) if results.right_hand_landmarks else np.zeros(21*3)

    return np.concatenate([pose, face, lh, rh])


# ---------- Per-client state ----------
clients_sequences = {}      # client_id -> deque of keypoints
clients_predictions = {}    # client_id -> deque of last predictions for smoothing

# ---------- WebSocket endpoint ----------


@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())
    clients_sequences[client_id] = deque(maxlen=SEQUENCE_LENGTH)
    clients_predictions[client_id] = deque(maxlen=SMOOTHING_WINDOW)
    print(f"Client connected: {client_id}")
    try:
        # Each websocket connection gets its own Mediapipe Holistic context
        with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
            while True:
                # Expect binary messages (JPEG frames). Could also accept JSON commands.
                message = await websocket.receive_bytes()
                # decode bytes -> numpy image
                nparr = np.frombuffer(message, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)  # BGR

                # optional: resize to smaller resolution for speed
                frame_small = cv2.resize(frame, (320, 240))

                # process with Mediapipe
                results = mediapipe_process_frame(frame_small, holistic)
                keypoints = extract_keypoints(results).astype(np.float32)
                clients_sequences[client_id].append(keypoints)

                response = {"ready": False}

                if len(clients_sequences[client_id]) == SEQUENCE_LENGTH:
                    seq = np.expand_dims(
                        np.array(clients_sequences[client_id], dtype=np.float32), axis=0)
                    res = model.predict(seq, verbose=0)[
                        0]  # softmax probabilities
                    pred_idx = int(np.argmax(res))
                    conf = float(res[pred_idx])

                    # smoothing
                    clients_predictions[client_id].append(pred_idx)
                    most_common = max(set(
                        clients_predictions[client_id]), key=clients_predictions[client_id].count) if clients_predictions[client_id] else None

                    if conf > THRESHOLD and most_common == pred_idx:
                        predicted_action = actions[pred_idx]
                    else:
                        predicted_action = "..."

                    # send top-K probabilities for UI if desired
                    probs = {actions[i]: float(res[i])
                             for i in range(len(actions))}
                    response = {
                        "ready": True,
                        "predicted_action": predicted_action,
                        "confidence": conf,
                        "probs": probs
                    }

                # send JSON response
                await websocket.send_text(json.dumps(response))

    except WebSocketDisconnect:
        print(f"Client disconnected: {client_id}")
    except Exception as e:
        print("Error in websocket:", e)
    finally:
        # cleanup
        clients_sequences.pop(client_id, None)
        clients_predictions.pop(client_id, None)

# ---------- HTTP health check route ----------


@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8001, log_level="info")
