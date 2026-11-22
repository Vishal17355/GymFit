"""Build the fitted skin GLB from the bundled anatomical meshes.

Requires NumPy, SciPy, scikit-image and fast-simplification. Run from any directory.
"""
import json
from pathlib import Path
import struct

import numpy as np
from fast_simplification import simplify
from scipy import ndimage
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes

from anatomy_skin_topology import refine_detail_topology
from anatomy_skin_details import (
    add_ear_form, digit_bounds, motion_zones, refine_landmarks, region, separate_digits, separate_junctions, surface_colors,
)

ASSETS = Path(__file__).resolve().parents[1] / "public" / "anatomy3d"
STEP = 3.75
BONE_OFFSET = 32768


def read_meshes(filename, index_offset=0):
    data = (ASSETS / filename).read_bytes()
    json_size, json_type = struct.unpack_from("<II", data, 12)
    if data[:4] != b"glTF" or json_type != 0x4E4F534A:
        raise ValueError(f"{filename} is not a binary glTF file")
    info = json.loads(data[20:20 + json_size])
    binary = memoryview(data)[28 + json_size:]

    def accessor(index, width, dtype):
        asset = info["accessors"][index]
        view = info["bufferViews"][asset["bufferView"]]
        stride = view.get("byteStride", width * np.dtype(dtype).itemsize)
        return np.ndarray(
            (asset["count"], width), dtype=dtype, buffer=binary,
            offset=view.get("byteOffset", 0) + asset.get("byteOffset", 0),
            strides=(stride, np.dtype(dtype).itemsize),
        )

    meshes = []
    for index, mesh in enumerate(info["meshes"]):
        primitive, = mesh["primitives"]
        vertices = accessor(primitive["attributes"]["POSITION"], 3, "<f4")
        faces = accessor(primitive["indices"], 1, "<u2").reshape(-1, 3)
        meshes.append((index_offset + index, vertices, faces, mesh.get("name", "")))
    return meshes


def rasterize(vertices, faces, field, origin):
    def mark(points):
        indexes = np.rint((points - origin) / STEP).astype(np.intp)
        field[tuple(indexes.T)] = True

    mark(vertices)
    triangles = vertices[faces]
    while len(triangles):
        a, b, c = triangles.transpose(1, 0, 2)
        edges = [np.sum((a - b) ** 2, axis=1), np.sum((b - c) ** 2, axis=1),
                 np.sum((c - a) ** 2, axis=1)]
        large = np.maximum.reduce(edges) > (STEP * 1.4) ** 2
        mark(triangles[~large].mean(axis=1))
        a, b, c = a[large], b[large], c[large]
        ab, bc, ca = (a + b) / 2, (b + c) / 2, (c + a) / 2
        mark(np.concatenate((ab, bc, ca)))
        triangles = np.concatenate([
            np.stack(corners, axis=1) for corners in ((a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca))
        ])


def skin_density(solid, x, y, z):
    softened = solid.astype(np.float32)
    field = ndimage.gaussian_filter(softened, sigma=1.12)
    defined = ndimage.gaussian_filter(softened, sigma=0.78)
    lateral = abs(x)

    muscle_detail = np.maximum.reduce([
        region(lateral, y, z, (120, -158, 1190), (122, 100, 170)),
        region(lateral, y, z, (95, -137, 960), (102, 103, 145)),
        region(lateral, y, z, (114, -109, 582), (79, 93, 176)),
        region(lateral, y, z, (128, -18, 1165), (113, 56, 169)),
    ])
    field += (defined - field) * muscle_detail * 0.72

    # Smooth along the limb across a joint while retaining its bony profile.
    joint_density = ndimage.gaussian_filter(softened, sigma=(1.12, 0.99, 2.1))
    joints = np.maximum.reduce([
        region(lateral, y, z, (173, -79, 1265), (52, 72, 74)),
        region(lateral, y, z, (213, -76, 1042), (43, 46, 52)),
        region(lateral, y, z, (242, -112, 814), (39, 41, 42)),
        region(lateral, y, z, (83, -80, 374), (46, 54, 48)),
    ])
    field += (joint_density - field) * joints * 0.78

    # Round deep source seams near the pectoral insertions, lower ribs and ankle.
    transitions = np.maximum.reduce([
        region(lateral, y, z, (143, -154, 1186), (41, 51, 57)),
        region(lateral, y, z, (117, -146, 1060), (48, 54, 95)),
        region(lateral, y, z, (75, -71, 35), (38, 48, 47)),
        region(lateral, y, z, (26, -186, 1557), (22, 26, 23)),
        region(lateral, y, z, (106, -17, 1144), (61, 34, 113)) * .62,
    ])
    field += (joint_density - field) * transitions * 0.45
    return field


def refine_proportions(vertices):
    shape = vertices.copy()
    x, y, z = vertices.T
    side = np.sign(x)
    lateral = abs(x)

    shoulder = region(lateral, y, z, (213, -74, 1307), (41, 78, 68))
    waist = region(lateral, y, z, (119, -103, 964), (39, 103, 95))
    thigh = region(lateral, y, z, (153, -85, 616), (36, 84, 153))
    elbow = region(lateral, y, z, (231, -68, 1045), (26, 57, 44))
    wrist = region(lateral, y, z, (260, -119, 808), (24, 49, 47))
    shape[:, 0] -= side * (6.8 * shoulder + 6.2 * waist + 6.3 * thigh + 2.8 * elbow + 2.7 * wrist)

    upper_chest = region(lateral, y, z, (98, -154, 1243), (62, 72, 66))
    lower_chest = region(lateral, y, z, (110, -197, 1147), (70, 66, 58))
    kneecap = region(lateral, y, z, (82, -118, 385), (27, 35, 27))
    calf = region(lateral, y, z, (92, -18, 262), (37, 37, 76))
    shape[:, 1] += -6.8 * upper_chest + 3.9 * lower_chest - 2.8 * kneecap + 3.1 * calf

    tissue = region(lateral, y, z, (119, -98, 900), (133, 99, 410))
    shape[:, 0] += 1.65 * np.sin(z / 87 + y / 39) * tissue
    shape[:, 1] += 1.25 * np.sin(x / 43 + z / 133) * tissue
    return shape


def simplify_preserving_landmarks(vertices, faces):
    x, y, z = vertices[faces].mean(axis=1).T
    detailed = (
        ((z > 1420) & (y < -141)) |
        ((z > 1465) & (z < 1535) & (abs(x) > 54)) |
        ((z < -26) & (y < -132))
    )

    def subset(triangles):
        used, inverse = np.unique(triangles, return_inverse=True)
        return vertices[used], inverse.reshape(-1, 3)

    local, local_faces = subset(faces[detailed])
    outer, outer_faces = subset(faces[~detailed])
    outer, outer_faces = simplify(outer, outer_faces,
                                  target_count=min(85_000, len(outer_faces)), agg=4.7, preserve_border=True)
    points = np.concatenate((local, outer))
    triangles = np.concatenate((local_faces, outer_faces + len(local)))
    # The simplifier locks the patch boundary. Weld those shared coordinates.
    _, unique, inverse = np.unique(np.rint(points * 100_000).astype(np.int64), axis=0,
                                   return_index=True, return_inverse=True)
    return points[unique], inverse[triangles]


def solid_surface(meshes, digits):
    points = np.concatenate([vertices for _, vertices, _, _ in meshes])
    origin = np.floor(points.min(axis=0) / STEP) * STEP - STEP * 9
    shape = np.ceil((points.max(axis=0) - origin) / STEP).astype(int) + 10
    surface = np.zeros(shape, dtype=bool)
    for _, vertices, faces, _ in meshes:
        rasterize(vertices, faces, surface, origin)

    # The bundled bones and muscles leave a small opening at the pelvis floor.
    # Fill only that region so the inner thighs keep their separate contours.
    x, y, z = np.ogrid[:shape[0], :shape[1], :shape[2]]
    x, y, z = x * STEP + origin[0], y * STEP + origin[1], z * STEP + origin[2]
    surface |= (x / 27) ** 2 + ((y + 95) / 67) ** 2 + ((z - 748) / 18) ** 2 <= 1

    # Close gaps in the body while retaining finer gaps around the fingers.
    wrapped = ndimage.binary_dilation(surface, iterations=1)
    solid = ndimage.binary_closing(wrapped, iterations=3)
    hands = np.broadcast_to((abs(x) > 203) & (z >= 625) & (z <= 763), shape)
    hand_detail = ndimage.binary_closing(wrapped, iterations=1)
    solid[hands] = hand_detail[hands]
    solid = ndimage.binary_fill_holes(solid)
    labels, _ = ndimage.label(solid)
    counts = np.bincount(labels.ravel())
    counts[0] = 0
    solid = labels == counts.argmax()
    field = skin_density(solid, x, y, z)
    add_ear_form(field, x, y, z)
    separate_junctions(field, x, y, z)
    separate_digits(field, x, y, z, digits)
    vertices, faces, normals, _ = marching_cubes(field, level=0.42, allow_degenerate=False)
    vertices = vertices * STEP + origin

    # Match the triangle winding to the outward field normals.
    face_vertices = vertices[faces]
    cross = np.cross(face_vertices[:, 1] - face_vertices[:, 0], face_vertices[:, 2] - face_vertices[:, 0])
    if np.einsum("ij,ij->", cross, normals[faces[:, 0]]) < 0:
        faces = faces[:, [0, 2, 1]]

    # Keep the outer shell. Enclosed internal cavities are unnecessary geometry.
    edges = faces[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2)
    adjacency = coo_matrix(
        (np.ones(len(edges), dtype=bool), edges.T), shape=(len(vertices), len(vertices))
    ).tocsr()
    _, components = connected_components(adjacency, directed=False)
    outer = np.bincount(components).argmax()
    faces = faces[components[faces[:, 0]] == outer]
    used_vertices, remapped_faces = np.unique(faces, return_inverse=True)
    vertices = refine_proportions(vertices[used_vertices])
    normals = normals[used_vertices]
    faces = remapped_faces.reshape(-1, 3)

    original = cKDTree(vertices)
    shell, faces = simplify_preserving_landmarks(vertices, faces)
    shell, faces = refine_detail_topology(shell, faces)
    _, near = original.query(shell, k=3, workers=-1)
    normals = normals[near].mean(axis=1)
    shell = refine_landmarks(shell, digits)
    triangle = shell[faces]
    face_normals = np.cross(triangle[:, 1] - triangle[:, 0], triangle[:, 2] - triangle[:, 0])
    geometric = np.zeros_like(shell)
    for index in range(3):
        np.add.at(geometric, faces[:, index], face_normals)
    geometric /= np.maximum(np.linalg.norm(geometric, axis=1, keepdims=True), 1e-8)
    detailed = ((shell[:, 2] > 1422) & (shell[:, 1] < -147)) | (
        (abs(shell[:, 0]) > 58) & (shell[:, 2] > 1466) & (shell[:, 2] < 1534)
    )
    blend = np.where(detailed, .81, .48)[:, None]
    normals = (1 - blend) * normals + blend * geometric
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-8)
    return shell, faces, normals


def transfer_references(meshes, vertices):
    points = np.concatenate([values for _, values, _, _ in meshes])
    mesh_ids = np.concatenate([np.full(len(values), index, dtype=np.uint16) for index, values, _, _ in meshes])
    vertex_ids = np.concatenate([np.arange(len(values), dtype=np.uint16) for _, values, _, _ in meshes])

    # Remove duplicate seams so the four samples describe different surface points.
    _, unique = np.unique(np.rint(points * 2).astype(np.int32), axis=0, return_index=True)
    tree = cKDTree(points[unique])
    distances, neighbors = tree.query(vertices, k=4, workers=-1)
    shares = 1 / (distances + 3.0) ** 2
    shares /= shares.sum(axis=1, keepdims=True)
    points = unique[neighbors]
    return mesh_ids[points], vertex_ids[points], np.rint(shares * 255).astype(np.uint8)


def write_glb(vertices, faces, normals, references, colors):
    binary = bytearray()
    views = []
    accessors = []

    def add(array, dtype, component, kind, target, bounds=False):
        values = np.ascontiguousarray(array, dtype=dtype)
        offset = len(binary)
        binary.extend(values.tobytes())
        binary.extend(b"\x00" * (-len(binary) % 4))
        view = len(views)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": values.nbytes, "target": target})
        item = {"bufferView": view, "componentType": component, "count": len(values), "type": kind}
        if bounds:
            item.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        accessors.append(item)
        return view

    attributes = {
        "POSITION": add(vertices, "<f4", 5126, "VEC3", 34962, bounds=True),
        "NORMAL": add(normals, "<f4", 5126, "VEC3", 34962),
        "_SOURCE_MESH": add(references[0], "<u2", 5123, "VEC4", 34962),
        "_SOURCE_VERTEX": add(references[1], "<u2", 5123, "VEC4", 34962),
        "_SOURCE_MIX": add(references[2], "u1", 5121, "VEC4", 34962),
        "COLOR_0": add(colors, "<f4", 5126, "VEC3", 34962),
        "_MOTION_ZONE": add(motion_zones(vertices), "u1", 5121, "VEC4", 34962),
    }
    index_type, component = ("<u2", 5123) if len(vertices) <= 65535 else ("<u4", 5125)
    index = add(faces.ravel(), index_type, component, "SCALAR", 34963)
    description = {
        "asset": {"version": "2.0", "generator": "GymFit anatomical skin"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "FittedSkin", "mesh": 0}],
        "meshes": [{"primitives": [{"attributes": attributes, "indices": index}]}],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(binary)}],
    }
    encoded = json.dumps(description, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    total = 28 + len(encoded) + len(binary)
    output = ASSETS / "skin.glb"
    with output.open("wb") as file:
        file.write(struct.pack("<4sIIII", b"glTF", 2, total, len(encoded), 0x4E4F534A))
        file.write(encoded)
        file.write(struct.pack("<II", len(binary), 0x004E4942))
        file.write(binary)
    print(f"{output.name}: {len(vertices):,} vertices, {len(faces):,} triangles, {total:,} bytes")


if __name__ == "__main__":
    sources = read_meshes("anatomy.glb") + read_meshes("skeleton.glb", BONE_OFFSET)
    digits = list(digit_bounds(sources))
    shell, triangles, normals = solid_surface(sources, digits)
    references = transfer_references(sources, shell)
    write_glb(shell, triangles, normals, references, surface_colors(shell, digits))
