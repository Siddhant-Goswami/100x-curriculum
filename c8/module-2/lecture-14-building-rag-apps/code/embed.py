"""embed.py: turn any text into 384 numbers, on your own laptop.

The model is gte-small, the one the RAG Lab uses: open source, on Hugging Face at
https://huggingface.co/thenlper/gte-small . 33 million parameters, about 70 MB, runs on a CPU.

  pip install sentence-transformers
  python embed.py "Why is the model making things up?"
  python embed.py "Why is the model making things up?" "The model will hallucinate when it does not know."

The first run downloads the model once. After that it works offline."""
import sys
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("thenlper/gte-small")

def numbers_for(text):
    """384 numbers for a text. normalize_embeddings=True makes every list the same length (1)."""
    return model.encode(text, normalize_embeddings=True).tolist()

if __name__ == "__main__":
    texts = sys.argv[1:] or ["Why is the model making things up?"]
    for text in texts:
        v = numbers_for(text)
        print(repr(text))
        print("  ", len(v), "numbers. The first eight:", [round(x, 3) for x in v[:8]])
        print("   Length:", round(sum(x * x for x in v) ** 0.5, 3))
