"""Conforming local subdivision for small anatomical landmarks."""
import numpy as np


def refine_detail_topology(vertices, faces):
    # Each template splits only edges marked for subdivision. Shared edges get
    # one shared midpoint, so the eye, hand and foot patches stay watertight.
    templates = [
        [0, 1, 2],
        [0, 3, 2, 3, 1, 2],
        [0, 1, 4, 0, 4, 2],
        [0, 3, 2, 3, 4, 2, 3, 1, 4],
        [0, 1, 5, 1, 2, 5],
        [0, 3, 5, 3, 1, 2, 3, 2, 5],
        [0, 1, 4, 0, 4, 5, 5, 4, 2],
        [0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 4, 5],
    ]
    edges_on_face = [0, 1, 1, 2, 2, 0]
    for _ in range(3):
        edges, from_face = np.unique(
            np.sort(faces[:, edges_on_face].reshape(-1, 2), axis=1), axis=0, return_inverse=True
        )
        ends = vertices[edges]
        mids = ends.mean(axis=1)
        x, y, z = mids.T
        lateral = abs(x)
        length = np.linalg.norm(ends[:, 1] - ends[:, 0], axis=1)

        front_face = (z > 1422) & (z < 1562) & (y < -151) & (lateral < 64)
        ear = (z > 1466) & (z < 1534) & (lateral > 60) & (abs(y + 87) < 22)
        hand = (z > 643) & (z < 795) & (lateral > 220)
        toe = (z < -34) & (y < -165) & (lateral > 82)
        fine = (
            (front_face & (length > 2.45)) | (ear & (length > 2.85)) |
            (hand & (length > 3.75)) | (toe & (length > 3.65))
        )
        if not fine.any():
            break

        new_vertex = np.full(len(edges), -1, dtype=np.int64)
        new_vertex[fine] = np.arange(len(vertices), len(vertices) + int(fine.sum()))
        face_midpoints = new_vertex[from_face].reshape(-1, 3)
        mask = (face_midpoints >= 0) @ np.array([1, 2, 4])
        corners = np.column_stack((faces, face_midpoints))
        faces = np.concatenate([
            corners[mask == code][:, template].reshape(-1, 3)
            for code, template in enumerate(templates)
        ])
        vertices = np.concatenate((vertices, mids[fine]))
    return vertices, faces
