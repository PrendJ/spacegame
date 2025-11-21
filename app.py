from pathlib import Path

from flask import Flask, send_from_directory

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR))


@app.route("/")
def index() -> object:
    """Serve the bundled static shell for the game client."""

    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
