// Arm targets use (outward, up, forward) offsets as fractions of arm reach.
// Pelvis travel and foot targets are fractions of standing model height.
export const exerciseMotions = {
  1: {
    seconds: 4, equipment: 'barbell', bench: true, feet: [0.025, 0.26], elbow: [1, -0.65, 0.05],
    bottom: { tilt: -90, lift: -0.20, arm: [0.44, -0.23, 0.34] },
    top: { tilt: -90, lift: -0.20, arm: [0.44, -0.06, 0.86] },
  },
  2: {
    seconds: 4.5, equipment: 'barbell', feet: [0.045, 0], elbow: [1, -0.7, -0.6],
    bottom: { lift: -0.15, shift: -0.085, lean: 29, arm: [0.56, 0.15, -0.36] },
    top: { arm: [0.56, 0.15, -0.36] },
  },
  3: {
    seconds: 4.5, equipment: 'barbell', feet: [0.018, 0], armSpace: 'world', elbow: [0.45, -0.2, -1],
    bottom: { lift: -0.20, shift: -0.11, lean: 60, arm: [0.28, -0.91, 0.18] },
    top: { arm: [0.28, -0.95, 0.06] },
  },
  4: {
    seconds: 4, equipment: 'dumbbells', bench: true, feet: [0.025, 0.26], elbow: [1, -0.65, 0.05],
    bottom: { tilt: -58, lift: -0.20, arm: [0.44, 0.02, 0.27] },
    top: { tilt: -58, lift: -0.20, arm: [0.31, 0.51, 0.73] },
  },
  5: {
    seconds: 4, equipment: 'barbell', elbow: [0.8, -1, 0.15],
    bottom: { arm: [0.38, 0.02, 0.41] },
    top: { arm: [0.38, 0.88, 0.10] },
  },
  6: {
    seconds: 4, equipment: 'handle', feet: [0.025, 0.38], seat: true, elbow: [0.65, -0.1, -1],
    bottom: { lift: -0.25, lean: 10, arm: [-0.12, -0.33, 0.90] },
    top: { lift: -0.25, arm: [-0.12, -0.45, 0.27] },
  },
  7: {
    seconds: 4.5, equipment: 'barbell', feet: [0.015, 0], armSpace: 'world', elbow: [0.5, -0.25, -1],
    bottom: { lift: -0.055, shift: -0.095, lean: 58, arm: [0.28, -0.94, 0.11] },
    top: { arm: [0.28, -0.95, 0.05] },
  },
  8: {
    seconds: 4, equipment: 'dumbbells', elbow: [0.2, -1, -0.75],
    bottom: { arm: [0.17, -0.95, 0.1] },
    top: { arm: [0.94, -0.02, 0.11] },
  },
};
