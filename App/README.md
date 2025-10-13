Step 1
add images to Images/placeholder.jpg cahnge acotding to that in practis.html

Step2:
Run Backend:

In terminal: python app.py
Verify it starts, prints "Actions loaded: ['අ', 'ආ', ...]" and runs on port 8001.
Ensure best_model.h5 and actions.npy are in the root (model must match the trained letters).

Ensure Images:

In /images, add අ.jpg, ආ.jpg, etc., for each letter (අ, ආ, ඇ, ඈ, එ, ඒ, ඉ, ඊ, උ, ඌ). These should be clear photos of the signs.
Keep placeholder.jpg for fallback if any image is missing.
Example: If images/අ.jpg doesn’t exist, it’ll show placeholder.jpg.