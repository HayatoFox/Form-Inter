"""Point d'entrée : python3 -m webapp [--port 8000]"""

import argparse

from . import config
from .app import creer_serveur


def main() -> None:
    parser = argparse.ArgumentParser(description="Site interne PROINSEC Formations")
    parser.add_argument("--port", type=int, default=config.PORT)
    args = parser.parse_args()

    serveur = creer_serveur(args.port)
    print(f"[webapp] En écoute sur http://0.0.0.0:{args.port}")
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\n[webapp] Arrêt.")


if __name__ == "__main__":
    main()
