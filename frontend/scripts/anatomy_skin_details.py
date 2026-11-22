"""Localized skin edits in the anatomy assets' millimeter coordinates."""
import numpy as np


def region(x, y, z, center, radius):
    cx, cy, cz = center
    rx, ry, rz = radius
    return np.exp(-((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2 - ((z - cz) / rz) ** 2)


def axilla_boundary(y, z):
    return 147 + (1210 - z) * 0.145 + ((y + 84) / 70) ** 2 * 3.5


def cut_gap(field, distance, half_width):
    # The scalar cut tapers back into the skin where the gap closes.
    np.minimum(field, np.where(half_width > 0, 0.42 + (distance - half_width) * 0.11, 1.0), out=field)


def separate_junctions(field, x, y, z):
    arm_width = np.clip(np.minimum((1237 - z) * 0.23, (z - 900) * 0.11), 0, 7)
    cut_gap(field, abs(abs(x) - axilla_boundary(y, z)), arm_width)
    leg_width = np.clip((759 - z) * 0.19, 0, 5.5)
    cut_gap(field, abs(x), leg_width)


def digit_bounds(meshes):
    names = {name: vertices for _, vertices, _, name in meshes}
    hands = ['little finger', 'ring finger', 'middle finger', 'index finger', 'thumb']
    feet = ['big toe', 'second toe', 'third toe', 'fourth toe', 'little toe']
    for side, sign in [('left', 1), ('right', -1)]:
        for kind, digits in [('hand', hands), ('foot', feet)]:
            along = 2 if kind == 'hand' else 1
            group = []
            for digit in digits:
                base = names[f'proximal phalanx of {side} {digit}']
                tip = names[f'distal phalanx of {side} {digit}']
                start = base[base[:, along] >= np.quantile(base[:, along], 0.8)].mean(axis=0)
                end = tip[tip[:, along] <= np.quantile(tip[:, along], 0.35)].mean(axis=0)
                middle = names.get(f'middle phalanx of {side} {digit}')
                joints = [start]
                if middle is not None:
                    joints.append(middle[middle[:, along] >= np.quantile(middle[:, along], .8)].mean(axis=0))
                joints.append(tip[tip[:, along] >= np.quantile(tip[:, along], .8)].mean(axis=0))
                group.append((start, end, tip.min(axis=0), tip.max(axis=0), joints))
            yield kind, sign, group


def separate_digits(field, x, y, z, digits):
    for kind, sign, group in digits:
        for first, second in zip(group, group[1:]):
            if kind == 'hand':
                axis, along, in_range = 2, z, (z > 630) & (z < 770) & (sign * x > 203)
            else:
                axis, along, in_range = 1, y, (z < -27) & (sign * x > 78)

            start = min(first[0][axis], second[0][axis]) - (5 if kind == 'hand' else 1)
            tip = min(first[2][axis], second[2][axis])
            first_x = np.interp(along, [first[1][axis], first[0][axis]], [first[1][0], first[0][0]])
            second_x = np.interp(along, [second[1][axis], second[0][axis]], [second[1][0], second[0][0]])
            center = (first_x + second_x) / 2
            width = np.clip(np.minimum((start - along) * 0.32, (along - tip + 18) * 0.30), 0, 2.35)
            cut_gap(field, abs(x - center), width * in_range)


def add_ear_form(field, x, y, z):
    for sign in (-1, 1):
        y_axis = y + 86 - (z - 1501) * 0.18
        distance = ((x - sign * 68.7) / 10.5) ** 2 + (y_axis / 13.2) ** 2 + ((z - 1501) / 22) ** 2
        ear = 0.42 + (1 - distance) * 0.27
        blend = .083
        seam = np.maximum(blend - abs(field - ear), 0)
        field[:] = np.maximum(field, ear) + seam ** 2 / (4 * blend)


def nail_region(x, y, z, kind, tip, minimum, maximum):
    center = (minimum + maximum) / 2
    width = maximum[0] - minimum[0]
    if kind == 'hand':
        return region(x, y, z, (center[0], maximum[1] + 1.4, tip[2] + 3),
                      (max(3, width * .53), 6.5, 7.7))
    return region(x, y, z, (center[0], tip[1] + 4, maximum[2] + 1.9),
                  (max(3, width * .49), 7.7, 5.0))


def refine_landmarks(vertices, digits):
    shape = vertices.copy()
    x, y, z = vertices.T
    lateral = abs(x)

    # External face landmarks are measured in the resting anatomical pose.
    cheek = region(lateral, y, z, (43, -161, 1488), (16, 25, 17))
    chin = region(x, y, z, (0, -176, 1432), (18, 27, 9))
    crease_below_lip = region(x, y, z, (0, -179, 1441), (14, 18, 3))
    jaw = region(lateral, y, z, (42, -136, 1449), (14, 34, 20))
    nasal_bridge = region(x, y, z, (0, -186, 1519), (7.1, 18, 15))
    nasal_tip = region(x, y, z, (0, -194, 1495), (8.4, 19, 8.5))
    nasal_ala = region(lateral, y, z, (8.5, -193.5, 1489.7), (4.9, 17, 5.1))
    nostril = region(lateral, y, z, (6.65, -197, 1486.8), (3.25, 13, 2.7))

    eye_x = (lateral - 30.5) / 15.7
    eye_center_z = 1517.5 + (lateral - 30.5) * 0.065
    opening = np.sqrt(np.maximum(0, 1 - eye_x ** 2))
    orbital = region(lateral, y, z, (30.5, -169, 1517.7), (17, 20, 10))
    eye_depth = np.exp(-((y + 172) / 19) ** 2 - eye_x ** 6)
    aperture = 1 - ((lateral - 30.5) / 13.2) ** 2 - ((z - eye_center_z) / 4.4) ** 2
    eye_globe = np.sqrt(np.maximum(0, aperture)) * np.clip(aperture * 4, 0, 1) * eye_depth
    upper_lid = np.exp(-((z - eye_center_z - 4 * opening) / 1.28) ** 2) * eye_depth * opening
    lower_lid = np.exp(-((z - eye_center_z + 3.05 * opening) / 1.42) ** 2) * eye_depth * opening
    lid_fold = np.exp(-((z - eye_center_z - 6.7 * opening) / 1.5) ** 2) * eye_depth * opening

    bow = 1458.65 + 1.4 * np.exp(-((lateral - 5.6) / 3.2) ** 2) - 0.10 * lateral
    lip_profile = np.exp(-(x / 18.8) ** 4 - ((y + 188) / 19) ** 2)
    upper_lip = np.exp(-((z - bow) / 2.4) ** 2) * lip_profile
    lower_lip = region(x, y, z, (0, -188, 1451.3), (16.8, 19, 3.4))
    lip_line = np.exp(-((z - 1455.1 - (lateral / 21) ** 2) / 1.1) ** 2) * lip_profile

    ear_axis = y + 86 - (z - 1501) * 0.18
    ear_radius = np.sqrt((ear_axis / 12.7) ** 2 + ((z - 1501) / 21) ** 2)
    ear_depth = np.exp(-((lateral - 75.5) / 7.5) ** 2)
    helix = np.exp(-((ear_radius - .76) / .155) ** 2) * ear_depth
    concha = region(lateral, y, z, (77, -88, 1498), (10, 6.1, 9.8))
    antihelix = region(lateral, y, z, (76, -80, 1505), (10, 3.5, 12.1))
    tragus = region(lateral, y, z, (73.5, -96.3, 1498), (8, 3.6, 5.5))
    lobe = region(lateral, y, z, (72.5, -88, 1485.5), (8.4, 5.8, 6.3))

    shape[:, 0] += np.sign(x) * (1.32 * jaw + 1.5 * helix - 2.05 * concha + .92 * antihelix + .77 * tragus + .81 * lobe)
    shape[:, 1] += -2.2 * cheek - 2.2 * chin + .72 * crease_below_lip
    shape[:, 1] += -1.75 * nasal_bridge - 3.1 * nasal_tip - 1.12 * nasal_ala + 2.15 * nostril
    shape[:, 1] += 1.55 * orbital - 2.8 * eye_globe - 1.3 * upper_lid - 1.04 * lower_lid + .49 * lid_fold
    shape[:, 1] += -1.75 * upper_lip - 2.03 * lower_lip + .95 * lip_line

    # Surface landmarks stay shallow. The deeper muscle meshes remain separate.
    clavicle_z = 1336 - 0.11 * (lateral - 64)
    clavicle = np.exp(-((lateral - 69) / 66) ** 2 - ((y + 126) / 36) ** 2 - ((z - clavicle_z) / 6) ** 2)
    sternum = region(x, y, z, (0, -198, 1235), (15, 43, 74))
    nipple = region(lateral, y, z, (92, -206, 1172), (4.8, 25, 4.2))
    areola = region(lateral, y, z, (92, -206, 1172), (10.2, 29, 8.8))
    navel_depth = np.exp(-((y + 201) / 28) ** 2)
    navel_radius = np.sqrt(((x - 2) / 5.7) ** 2 + ((z - 948) / 4.5) ** 2)
    navel_fossa = np.exp(-(navel_radius / .58) ** 2) * navel_depth
    navel_rim = np.exp(-((navel_radius - .88) / .27) ** 2) * navel_depth
    navel_hood = region(x, y, z, (2, -199, 951.5), (5.6, 24, 2.5))
    line = region(x, y, z, (0, -213, 1028), (8.4, 30, 91))
    pec = region(lateral, y, z, (101, -190, 1229), (63, 51, 57))
    pec_attach_z = 1207 + 1.02 * (lateral - 124)
    pec_attachment = np.exp(-((lateral - 143) / 30) ** 2 - ((y + 137) / 33) ** 2
                            - ((z - pec_attach_z) / 37) ** 2)
    lower_ribs = region(lateral, y, z, (107, -168, 1104), (47, 37, 50))
    oblique = np.exp(-((lateral - 108) / 21) ** 2 - ((y + 168) / 47) ** 2 - ((z - 1003 - (lateral - 106) * 1.2) / 25) ** 2)
    shape[:, 1] += -1.92 * clavicle - 1.35 * sternum - 1.46 * nipple - .38 * areola
    shape[:, 1] += 2.85 * navel_fossa - .42 * navel_rim - .69 * navel_hood + .73 * line
    shape[:, 1] += -1.36 * pec - 1.64 * pec_attachment - .74 * lower_ribs - .84 * oblique

    # Keep bony landmarks and the tendon profiles attached to their existing limbs.
    elbow = region(lateral, y, z, (211, -63, 1048), (20, 22, 16))
    wrist = region(lateral, y, z, (247, -105, 819), (14, 20, 16))
    achilles = region(lateral, y, z, (82, -42, 68), (12, 24, 54))
    heel = region(lateral, y, z, (78, -36, -45), (23, 18, 20))
    arch = region(lateral, y, z, (64, -137, -62), (17, 39, 17))
    deltoid = region(lateral, y, z, (198, -104, 1264), (32, 34, 44))
    biceps = region(lateral, y, z, (190, -109, 1151), (25, 28, 57))
    brachialis = region(lateral, y, z, (216, -92, 1081), (19, 18, 33))
    flexor_tendon = region(lateral, y, z, (240, -123, 835), (11, 14, 33))
    lateral_ankle = region(lateral, y, z, (100, -64, 19), (14, 24, 17))
    medial_ankle = region(lateral, y, z, (56, -74, 3), (12, 22, 17))
    patella = region(lateral, y, z, (82, -123, 382), (20, 24, 16))
    soleus = region(lateral, y, z, (96, -38, 168), (24, 27, 47))
    knee_fold = region(lateral, y, z, (82, -44, 373), (29, 23, 21))
    triceps = region(lateral, y, z, (191, -31, 1155), (29, 27, 62))
    forearm = region(lateral, y, z, (219, -103, 1008), (32, 26, 49))
    quadriceps = region(lateral, y, z, (111, -148, 589), (45, 46, 132))
    hamstrings = region(lateral, y, z, (106, -36, 555), (40, 48, 117))
    calf = region(lateral, y, z, (97, -15, 277), (34, 29, 59))
    palm = region(lateral, y, z, (260, -139, 762), (42, 13, 31))
    shape[:, 1] += 1.35 * elbow + 1.3 * achilles + 1.5 * heel
    shape[:, 1] += -1.4 * deltoid - 1.35 * biceps + 1.4 * triceps - .87 * forearm
    shape[:, 1] += -.82 * brachialis - .62 * flexor_tendon
    shape[:, 1] += -1.41 * quadriceps + 1.24 * hamstrings + 1.05 * calf + .81 * soleus - .83 * patella + .55 * knee_fold
    shape[:, 1] -= 1.22 * palm
    shape[:, 0] += np.sign(x) * (1.11 * wrist + 1.45 * lateral_ankle - 1.24 * medial_ankle)
    shape[:, 2] += 2.2 * arch

    for kind, _, group in digits:
        for _, tip, minimum, maximum, hinges in group:
            nail = nail_region(x, y, z, kind, tip, minimum, maximum)
            if kind == 'hand':
                shape[:, 1] += .71 * nail
                for index, hinge in enumerate(hinges):
                    radius = 6.2 if index == 0 else 4.4
                    knuckle = region(x, y, z, (hinge[0], hinge[1] + 6.7, hinge[2] - 3.1), (radius, 6.8, radius))
                    shape[:, 1] += (.86 if index == 0 else .48) * knuckle
            else:
                shape[:, 2] += .58 * nail
                toe_base = hinges[0]
                toe_pad = region(x, y, z, (toe_base[0], toe_base[1] - 6, toe_base[2] + 5), (5.1, 8.1, 4.6))
                shape[:, 2] += .48 * toe_pad
    return shape


def surface_colors(vertices, digits):
    x, y, z = vertices.T
    lateral = abs(x)
    # Subtle baked tones in linear color space. The material adds close-range grain.
    def linear(rgb):
        srgb = np.asarray(rgb) / 255
        return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)

    colors = np.repeat(linear((173, 119, 98))[None, :], len(vertices), axis=0)

    def tint(mask, rgb):
        mask = np.clip(mask, 0, 1)[:, None]
        colors[:] += (linear(rgb) - colors) * mask

    tint(region(lateral, y, z, (43, -164, 1490), (17, 32, 24)) * .13, (181, 115, 95))
    tint(region(lateral, y, z, (74, -86, 1500), (10, 12, 21)) * .25, (180, 105, 83))
    tint(region(lateral, y, z, (262, -149, 758), (41, 13, 26)) * .16, (200, 141, 113))
    tint(region(lateral, y, z, (81, -129, 381), (22, 15, 15)) * .12, (174, 109, 91))
    tint(region(lateral, y, z, (7.4, -200, 1486.8), (3.6, 19, 2.75)) * .67, (90, 53, 46))
    tint(region(x, y, z, (0, -192, 1455), (20, 26, 6.2)) * .68, (158, 83, 71))
    tint(region(x, y, z, (0, -194, 1455), (20, 24, 1.7)) * .71, (102, 54, 49))
    tint(region(lateral, y, z, (92, -212, 1172), (10.8, 30, 10.4)) * .57, (139, 82, 68))
    tint(region(x, y, z, (2, -204, 948), (4.8, 32, 4.2)) * .50, (122, 70, 58))

    for kind, _, group in digits:
        for _, tip, minimum, maximum, _ in group:
            tint(nail_region(x, y, z, kind, tip, minimum, maximum) * .74, (210, 167, 150))
    return np.clip(colors, 0, 1).astype('<f4')


def motion_zones(vertices):
    x, y, z = vertices.T
    lateral = abs(x)

    def smoothstep(value):
        value = np.clip(value, 0, 1)
        return value * value * (3 - 2 * value)

    # 1 torso, 2/3 left/right arm, 4/5 left/right leg. The second byte is the
    # constraint amount, tapered down around the actual shoulder and hip.
    upper = smoothstep((1237 - z) / 47) * smoothstep((z - 830) / 45)
    zone = np.where(lateral < axilla_boundary(y, z), 1, np.where(x > 0, 2, 3))
    leg = smoothstep((777 - z) / 34) * smoothstep((203 - lateral) / 14)
    zone = np.where(leg > 0, np.where(x > 0, 4, 5), zone)
    taper = np.maximum(upper, leg)
    shoulder = region(lateral, y, z, (156, -78, 1243), (42, 94, 57))
    pelvis = region(lateral, y, z, (13, -95, 760), (37, 99, 48))
    relaxation = np.maximum(shoulder, pelvis)
    return np.column_stack((
        np.where(taper > 0, zone, 0),
        np.rint(255 * taper),
        np.rint(255 * relaxation),
        np.zeros_like(zone),
    )).astype(np.uint8)
