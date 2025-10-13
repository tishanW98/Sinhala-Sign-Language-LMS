# app.py
import asyncio
import json
import uuid
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

# Add CORS middleware FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Load model + actions ----------
print("Loading model and actions...")
try:
    model = load_model(MODEL_PATH)
    actions = np.load(ACTIONS_PATH).tolist()
    print(f"✓ Model loaded successfully")
    print(f"✓ Actions loaded: {actions}")
except Exception as e:
    print(f"✗ Error loading model/actions: {e}")
    raise

# ---------- Mediapipe helpers ----------
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

FACE_IDX = [0, 13, 14, 17, 61, 291]


def mediapipe_process_frame(cv_image, holistic):
    """Process frame with Mediapipe"""
    image_rgb = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False
    results = holistic.process(image_rgb)
    image_rgb.flags.writeable = True
    return results


def extract_keypoints(results):
    """Extract keypoints from Mediapipe results"""
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
    
    print(f"✓ Client connected: {client_id}")
    
    try:
        with mp_holistic.Holistic(
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        ) as holistic:
            frame_count = 0
            
            while True:
                try:
                    # Receive binary frame data
                    message = await websocket.receive_bytes()
                    frame_count += 1
                    
                    # Decode JPEG to numpy array
                    nparr = np.frombuffer(message, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    if frame is None:
                        print(f"⚠ Frame {frame_count} decode failed")
                        continue
                    
                    # Resize for faster processing
                    frame_small = cv2.resize(frame, (320, 240))
                    
                    # Process with Mediapipe
                    results = mediapipe_process_frame(frame_small, holistic)
                    keypoints = extract_keypoints(results).astype(np.float32)
                    clients_sequences[client_id].append(keypoints)
                    
                    response = {"ready": False}
                    
                    # Once we have full sequence, make prediction
                    if len(clients_sequences[client_id]) == SEQUENCE_LENGTH:
                        seq = np.expand_dims(
                            np.array(clients_sequences[client_id], dtype=np.float32), 
                            axis=0
                        )
                        
                        # Predict
                        res = model.predict(seq, verbose=0)[0]
                        pred_idx = int(np.argmax(res))
                        conf = float(res[pred_idx])
                        
                        # Apply smoothing
                        clients_predictions[client_id].append(pred_idx)
                        
                        # Most common prediction in smoothing window
                        if clients_predictions[client_id]:
                            most_common = max(
                                set(clients_predictions[client_id]), 
                                key=clients_predictions[client_id].count
                            )
                        else:
                            most_common = None
                        
                        # Only show prediction if confident and consistent
                        if conf > THRESHOLD and most_common == pred_idx:
                            predicted_action = actions[pred_idx]
                        else:
                            predicted_action = "..."
                        
                        # Build probability dict
                        probs = {actions[i]: float(res[i]) for i in range(len(actions))}
                        
                        response = {
                            "ready": True,
                            "predicted_action": predicted_action,
                            "confidence": conf,
                            "probs": probs,
                            "frame_count": frame_count
                        }
                        
                        if frame_count % 50 == 0:
                            print(f"Client {client_id[:8]}: {predicted_action} ({conf:.2f})")
                    
                    # Send response
                    await websocket.send_text(json.dumps(response))
                    
                except WebSocketDisconnect:
                    print(f"✗ Client disconnected: {client_id}")
                    break
                except Exception as e:
                    print(f"⚠ Error processing frame: {e}")
                    continue
                    
    except Exception as e:
        print(f"✗ WebSocket error for {client_id}: {e}")
    finally:
        # Cleanup
        clients_sequences.pop(client_id, None)
        clients_predictions.pop(client_id, None)
        print(f"✓ Cleaned up client: {client_id}")


# ---------- HTTP endpoints ----------
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "actions": actions,
        "active_clients": len(clients_sequences)
    }


@app.get("/")
async def read_root():
    """Serve index.html"""
    return FileResponse("index.html")


@app.get("/{file_path:path}")
async def serve_files(file_path: str):
    """Serve static files"""
    import os
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return {"error": "File not found"}


# ---------- Main ----------
if __name__ == "__main__":
    print("\n" + "="*50)
    print("Starting Sinhala Sign Language Recognition Server")
    print("="*50)
    print(f"Model: {MODEL_PATH}")
    print(f"Actions: {actions}")
    print(f"Sequence Length: {SEQUENCE_LENGTH}")
    print(f"Threshold: {THRESHOLD}")
    print("="*50 + "\n")
    
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=8001, 
        log_level="info",
        reload=False  # Set to True for development
    )