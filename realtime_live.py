import cv2
import numpy as np
from collections import deque
import mediapipe as mp
from tensorflow.keras.models import load_model

# ---------- Config ----------
MODEL_PATH = "best_model.h5"
ACTIONS_PATH = "actions.npy"
SEQUENCE_LENGTH = 40       # must match train.py
THRESHOLD = 0.6            # min confidence
SMOOTHING_WINDOW = 12      # longer window for stability

# ---------- Mediapipe helpers ----------
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_face_mesh = mp.solutions.face_mesh

def mediapipe_detection(image, model):
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_rgb.flags.writeable = False
    results = model.process(image_rgb)
    image_rgb.flags.writeable = True
    image = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    return image, results

def draw_styled_landmarks(image, results):
    if results.face_landmarks:
        mp_drawing.draw_landmarks(
            image, results.face_landmarks, mp_face_mesh.FACEMESH_TESSELATION,
            mp_drawing.DrawingSpec(color=(80,110,10), thickness=1, circle_radius=1),
            mp_drawing.DrawingSpec(color=(80,256,121), thickness=1, circle_radius=1))
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(
            image, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(80,22,10), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(80,44,121), thickness=2, circle_radius=2))
    if results.left_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(121,22,76), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(121,44,250), thickness=2, circle_radius=2))
    if results.right_hand_landmarks:
        mp_drawing.draw_landmarks(
            image, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=4),
            mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2))

FACE_IDX = [0, 13, 14, 17, 61, 291]  # nose bridge, upper/lower lip centers, under lip, mouth corners

def extract_keypoints(results):
    pose = np.array([[res.x, res.y, res.z, res.visibility]
                     for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*4)

    if results.face_landmarks:
        face = np.array([[results.face_landmarks.landmark[i].x,
                          results.face_landmarks.landmark[i].y,
                          results.face_landmarks.landmark[i].z] for i in FACE_IDX]).flatten()
    else:
        face = np.zeros(len(FACE_IDX) * 3)

    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)

    return np.concatenate([pose, face, lh, rh])

def prob_viz(res, actions, input_frame):
    output_frame = input_frame.copy()
    for num, prob in enumerate(res):
        cv2.rectangle(output_frame, (0,60+num*40), (int(prob*250), 90+num*40), (245,117,16), -1)
        cv2.putText(output_frame, f"{actions[num]}: {prob:.2f}", (5,85+num*40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1, cv2.LINE_AA)
    return output_frame

# ---------- load model and actions ----------
model = load_model(MODEL_PATH)
actions = np.load(ACTIONS_PATH)
print("Actions loaded:", actions)

# ---------- realtime capture ----------
sequence = deque(maxlen=SEQUENCE_LENGTH)
predictions = deque(maxlen=SMOOTHING_WINDOW)
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Error: Could not open webcam. Try another index (0/1/2).")
    exit()
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        image, results = mediapipe_detection(frame, holistic)
        draw_styled_landmarks(image, results)

        keypoints = extract_keypoints(results)
        sequence.append(keypoints)

        if len(sequence) == SEQUENCE_LENGTH:
            input_data = np.expand_dims(np.array(sequence, dtype=np.float32), axis=0)
            res = model.predict(input_data, verbose=0)[0]
            pred_idx = int(np.argmax(res))
            predictions.append(pred_idx)

            most_common = max(set(predictions), key=predictions.count) if predictions else None
            conf = float(res[pred_idx])

            if conf > THRESHOLD and most_common == pred_idx:
                predicted_action = actions[pred_idx]
            else:
                predicted_action = "..."

            cv2.rectangle(image, (0,0), (400, 55), (245,117,16), -1)
            cv2.putText(image, f"Pred: {predicted_action} ({conf:.2f})", (10,35),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255), 2, cv2.LINE_AA)

            image = prob_viz(res, actions, image)

        cv2.imshow('Holistic + Action Recognition', image)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
