import cv2
import os
import glob
import shutil

def crop_anime_face(input_path, output_path, cascade_path):
    img = cv2.imread(input_path)
    if img is None:
        # Try to read it manually with numpy if there are unicode issues in path
        import numpy as np
        with open(input_path, 'rb') as f:
            chunk = f.read()
        chunk_arr = np.frombuffer(chunk, dtype=np.uint8)
        img = cv2.imdecode(chunk_arr, cv2.IMREAD_COLOR)
        
    if img is None:
        print(f"Failed to load {input_path}")
        return False
        
    height, width = img.shape[:2]
    cascade = cv2.CascadeClassifier(cascade_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(24, 24))
    
    if len(faces) > 0:
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        cx = x + w // 2
        cy = y + h // 2
        crop_size = int(max(w, h) * 1.8)
        crop_size = min(crop_size, width, height)
    else:
        crop_size = min(width, height)
        cx, cy = width // 2, height // 2

    x1 = max(0, cx - crop_size // 2)
    y1 = max(0, cy - crop_size // 2)
    x2 = min(width, x1 + crop_size)
    y2 = min(height, y1 + crop_size)
    
    if x2 - x1 < crop_size:
        x1 = max(0, x2 - crop_size)
    if y2 - y1 < crop_size:
        y1 = max(0, y2 - crop_size)
        
    cropped_img = img[y1:y2, x1:x2]
    final_img = cv2.resize(cropped_img, (256, 256), interpolation=cv2.INTER_AREA)
    
    # Save using imencode to handle any unicode path issues
    ext = os.path.splitext(output_path)[1]
    result, encoded_img = cv2.imencode(ext, final_img)
    if result:
        with open(output_path, mode='wb') as f:
            encoded_img.tofile(f)
        return True
    return False

def process_all():
    cascade_path = "lbpcascade_animeface.xml"
    
    mappings = {
        r"C:\Users\Ritesh\Downloads\csm": "public/avatars/csm",
        r"C:\Users\Ritesh\Downloads\baruto": "public/avatars/baruto",
        r"C:\Users\Ritesh\Downloads\bleach": "public/avatars/bleach"
    }
    
    for src_dir, dest_dir in mappings.items():
        if not os.path.exists(src_dir):
            continue
            
        os.makedirs(dest_dir, exist_ok=True)
        # clear existing
        for f in glob.glob(os.path.join(dest_dir, "*.jpg")):
            try: os.remove(f)
            except: pass
            
        images = glob.glob(os.path.join(src_dir, "*.jpg"))
        i = 1
        for img_path in images:
            out_path = os.path.join(dest_dir, f"img_{i}.jpg")
            success = crop_anime_face(img_path, out_path, cascade_path)
            if success:
                print(f"Cropped to {out_path}")
                i += 1

if __name__ == "__main__":
    process_all()
