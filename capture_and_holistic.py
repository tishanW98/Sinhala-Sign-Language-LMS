import cv2
import os
import time
import numpy as np
import mediapipe as mp

# ---------- CONFIG ----------
BASE_DIR = "VDO"
SEQUENCE_LENGTH = 40        # frames per sequence
VIDEO_DURATION = 6          # seconds per video
REST_DURATION = 3           # rest between videos
NUM_VIDEOS = 50             # total videos per class

# Mediapipe setup
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils

FACE_IDX = [0, 13, 14, 17, 61, 291]  # nose bridge, upper/lower lip centers, under lip, mouth corners

def mediapipe_detection(image, model):
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    results = model.process(image)
    image.flags.writeable = True
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

    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)

    return np.concatenate([pose, face, lh, rh])

def smooth_sequence(seq):
    seq = np.array(seq)
    for i in range(1, len(seq)):
        if not np.any(seq[i]):  # frame is all zeros
            seq[i] = seq[i-1]   # copy last good frame
    return seq

# ---------- Ask for class name ----------
class_name = input("Enter class name: ").strip()
save_dir = os.path.join(BASE_DIR, class_name)
os.makedirs(save_dir, exist_ok=True)
print(f"[INFO] Saving sequences to: {save_dir}")

# ---------- Open webcam ----------
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Cannot access webcam")
    exit()

# Get video properties
fps = cap.get(cv2.CAP_PROP_FPS)
if fps == 0:
    fps = 30.0
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fourcc = cv2.VideoWriter_fourcc(*'mp4v')

with mp_holistic.Holistic(min_detection_confidence=0.7,
                          min_tracking_confidence=0.7,
                          refine_face_landmarks=False) as holistic:

    for vid_idx in range(NUM_VIDEOS):
        vid_save_dir = os.path.join(save_dir, str(vid_idx))
        os.makedirs(vid_save_dir, exist_ok=True)

        print(f"\n[INFO] Video {vid_idx+1}/{NUM_VIDEOS}")

        # rest countdown
        for t in range(REST_DURATION, 0, -1):
            print(f"Rest... {t}", end="\r")
            time.sleep(1)

        seq = []
        print("[INFO] Recording...")
        start_time = time.time()
        writer = cv2.VideoWriter(os.path.join(save_dir, f"{vid_idx}.mp4"), fourcc, fps, (width, height))

        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Frame not captured")
                break

            # Mediapipe detection
            results = mediapipe_detection(frame, holistic)

            # Draw landmarks
            mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_holistic.POSE_CONNECTIONS)
            mp_drawing.draw_landmarks(frame, results.left_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
            mp_drawing.draw_landmarks(frame, results.right_hand_landmarks, mp_holistic.HAND_CONNECTIONS)
            mp_drawing.draw_landmarks(frame, results.face_landmarks, mp_holistic.FACEMESH_CONTOURS)

            # Extract keypoints
            keypoints = extract_keypoints(results)
            seq.append(keypoints)

            # Save frame to video
            writer.write(frame)

            cv2.imshow("Recording (Holistic)", frame)

            if (time.time() - start_time) > VIDEO_DURATION:
                break
            if cv2.waitKey(1) & 0xFF == ord('q'):  # manual quit
                break

        writer.release()

        # adjust to SEQUENCE_LENGTH
        if len(seq) < SEQUENCE_LENGTH:
            pad = [np.zeros_like(seq[0])] * (SEQUENCE_LENGTH - len(seq))
            seq.extend(pad)
        elif len(seq) > SEQUENCE_LENGTH:
            idxs = np.linspace(0, len(seq)-1, SEQUENCE_LENGTH).astype(int)
            seq = [seq[i] for i in idxs]

        seq = smooth_sequence(seq)

        # save npy sequence
        for f_idx, frame_data in enumerate(seq):
            np.save(os.path.join(vid_save_dir, f"{f_idx}.npy"), frame_data)

        print(f"[SAVED] {class_name}/{vid_idx} ({len(seq)} frames)")

print("\n[INFO] Done capturing sequences.")
cap.release()
cv2.destroyAllWindows()