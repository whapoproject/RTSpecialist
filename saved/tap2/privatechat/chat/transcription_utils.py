import whisper
import tempfile
import os

def transcribe_audio(audio_file):
    model = whisper.load_model("base")  # You can choose other models like 'small', 'medium', 'large'
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        for chunk in audio_file.chunks():
            temp_audio.write(chunk)
        temp_audio_path = temp_audio.name

    result = model.transcribe(temp_audio_path)
    os.remove(temp_audio_path)
    return result["text"]
