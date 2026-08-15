FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY bot/ /app/
# bot/db.py "api/models" dagi SQLAlchemy modellarni qayta ishlatadi (bitta
# schema manbai — ikkita alohida model ta'rifini saqlash xato ehtimolini
# oshiradi). Shu sababli models/ shu image ichiga ham nusxalanadi.
COPY api/models/ /app/models/

CMD ["python", "main.py"]
