# train.py
import os
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.utils import to_categorical
from sklearn.model_selection import train_test_split
from collections import Counter

# ---------- Config ----------
DATA_PATH = "VDO"
SEQUENCE_LENGTH = 40
EPOCHS = 150
BATCH_SIZE = 16
TEST_SIZE = 0.15
MODEL_OUT = "best_model.h5"
AUG_PER_SEQ = 25   # <-- number of augmentations per original sequence
np.random.seed(42)

# ---------- discover actions ----------
actions = sorted([d for d in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, d))])
print("Actions:", actions)
ACTION_TO_INDEX = {a: i for i, a in enumerate(actions)}

# ---------- infer keypoint length ----------
KEYPOINT_LENGTH = None
for a in actions:
    a_path = os.path.join(DATA_PATH, a)
    seqs = sorted([d for d in os.listdir(a_path) if os.path.isdir(os.path.join(a_path, d)) and d.isdigit()],
                  key=lambda x: int(x))
    for s in seqs:
        seq_path = os.path.join(a_path, s)
        files = sorted([f for f in os.listdir(seq_path) if f.endswith('.npy')])
        if files:
            arr = np.load(os.path.join(seq_path, files[0]))
            KEYPOINT_LENGTH = arr.shape[0]
            break
    if KEYPOINT_LENGTH:
        break
if KEYPOINT_LENGTH is None:
    raise FileNotFoundError("No .npy files found under DATA_PATH")
print("KEYPOINT_LENGTH =", KEYPOINT_LENGTH)

# ---------- augmentation functions ----------
def add_noise(seq, noise_std=0.02):
    return seq + np.random.normal(0, noise_std, seq.shape)

def time_warp(seq, max_warp=0.2):
    factor = np.random.uniform(1 - max_warp, 1 + max_warp)
    old_idx = np.linspace(0, SEQUENCE_LENGTH - 1, num=SEQUENCE_LENGTH)
    new_idx = np.linspace(0, SEQUENCE_LENGTH - 1, num=int(SEQUENCE_LENGTH * factor))
    warped = np.zeros((SEQUENCE_LENGTH, KEYPOINT_LENGTH))
    for k in range(KEYPOINT_LENGTH):
        warped[:, k] = np.interp(old_idx,
                                 new_idx[:SEQUENCE_LENGTH],
                                 seq[:len(new_idx[:SEQUENCE_LENGTH]), k])
    return warped

def frame_dropout(seq, drop_prob=0.15):
    mask = np.random.rand(SEQUENCE_LENGTH) > drop_prob
    dropped = seq[mask]
    if len(dropped) >= SEQUENCE_LENGTH:
        return dropped[:SEQUENCE_LENGTH]
    else:
        pad = np.zeros((SEQUENCE_LENGTH - len(dropped), KEYPOINT_LENGTH))
        return np.vstack([dropped, pad])

def random_augment(seq):
    # apply a random combo
    seq_aug = seq.copy()
    if np.random.rand() < 0.7:  # noise 70% chance
        seq_aug = add_noise(seq_aug)
    if np.random.rand() < 0.5:  # warp 50% chance
        seq_aug = time_warp(seq_aug)
    if np.random.rand() < 0.5:  # dropout 50% chance
        seq_aug = frame_dropout(seq_aug)
    return seq_aug

# ---------- load + augment ----------
sequences, labels = [], []

for action in actions:
    action_path = os.path.join(DATA_PATH, action)
    seq_dirs = sorted([d for d in os.listdir(action_path) if d.isdigit()], key=lambda x: int(x))
    for seq in seq_dirs:
        # load original sequence
        window = []
        for frame_num in range(SEQUENCE_LENGTH):
            npy_path = os.path.join(action_path, seq, f"{frame_num}.npy")
            if os.path.exists(npy_path):
                arr = np.load(npy_path)
                if arr.shape[0] != KEYPOINT_LENGTH:
                    arr = (np.pad(arr, (0, KEYPOINT_LENGTH - arr.shape[0]))
                           if arr.shape[0] < KEYPOINT_LENGTH else arr[:KEYPOINT_LENGTH])
            else:
                arr = np.zeros(KEYPOINT_LENGTH, dtype=np.float32)
            window.append(arr)
        window = np.array(window)

        # original
        sequences.append(window)
        labels.append(ACTION_TO_INDEX[action])

        # AUG_PER_SEQ augmentations
        for _ in range(AUG_PER_SEQ):
            aug_seq = random_augment(window)
            sequences.append(aug_seq)
            labels.append(ACTION_TO_INDEX[action])

X = np.array(sequences, dtype=np.float32)
y = to_categorical(labels).astype(int)

print("Original sequences:", len(labels) // (AUG_PER_SEQ + 1))
print("After augmentation:", len(labels))
print("X shape:", X.shape)
print("y shape:", y.shape)
print("Class distribution:", Counter(labels))

# ---------- train/test split ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=42, stratify=labels
)
print("Train:", X_train.shape, "Test:", X_test.shape)

# ---------- model ----------
model = Sequential()
model.add(LSTM(128, return_sequences=True, activation='relu', input_shape=(SEQUENCE_LENGTH, KEYPOINT_LENGTH)))
model.add(LSTM(64, return_sequences=False, activation='relu'))
model.add(Dense(64, activation='relu'))
model.add(Dense(len(actions), activation='softmax'))

model.compile(optimizer='Adam', loss='categorical_crossentropy', metrics=['categorical_accuracy'])
model.summary()

# ---------- callbacks ----------
callbacks = [
    ModelCheckpoint(MODEL_OUT, monitor='val_loss', save_best_only=True, verbose=1, mode='min'),
    EarlyStopping(monitor='val_loss', patience=30, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=7, verbose=1)
]

# ---------- train ----------
history = model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    callbacks=callbacks
)

# ---------- final evaluation ----------
loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"Final test loss: {loss:.4f}  test acc: {acc:.4f}")

# ---------- save ----------
np.save("actions.npy", np.array(actions))
print(f"Model + actions saved: {MODEL_OUT}, actions.npy")
