from flask import Flask, send_from_directory

app = Flask(__name__, static_folder="static")


@app.route("/")
def index() -> object:
    """Serve the main game shell.

    The game is a static canvas experience, so routing simply forwards to the
    bundled index that wires CSS/JS assets.
    """
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
