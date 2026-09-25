"""C05: 10-petal, single-wall TPU vase spring. All lengths in mm."""
import numpy as np

HEIGHT = 50.0
BASE_RADIUS = 61.0
TOP_RADIUS = 46.0
WALL = 1.0
PETALS = 10
PETAL_DEPTH = 8.0
AXIAL_FOLD = 2.5
LAYER = 0.16
LINE_WIDTH = 1.0


def radius(theta, z):
    q = np.asarray(z) / HEIGHT
    envelope = np.sin(np.pi * q) ** 2
    # Circular seats; circumferential petals and gentle axial folds in the body.
    return (BASE_RADIUS + (TOP_RADIUS - BASE_RADIUS) * q
            + envelope * (PETAL_DEPTH * np.cos(PETALS * theta)
                          + AXIAL_FOLD * np.sin(4 * np.pi * q)))
