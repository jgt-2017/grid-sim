/*
 * PURPOSE:    Keyframe-animated site life, played by an AnimationMixer (as in the three.js
 *             keyframe-animation example): a service van patrolling the east-west road with U-turns
 *             at each end, and an inspection drone flying a lawn-mower pattern over the solar field.
 * USED BY:    src/render/world.js
 * DEPENDS ON: three, src/config.js (AMBIENT, WORLD, VEHICLE), src/render/vehicle.js,
 *             src/render/droneModel.js
 * UNITS:      metres, seconds.
 */
import * as THREE from 'three';
import { AMBIENT, WORLD, VEHICLE } from '../config.js';
import { createVehicle } from './vehicle.js';
import { createDroneModel } from './droneModel.js';

const ROAD_Z_M = WORLD.roads.eastWest.z;   // east-west road centre line
const LANE_M = 1.8;            // offset of each lane from the centre line
const VAN_SPEED_MS = 7;        // used only to spin the van's wheels
const up = new THREE.Vector3(0, 1, 0);
const SURVEY_DRONE_SCALE = 3;  // enlarged so it reads from the ground (not to scale)

// Takes a list of yaw angles (rad); returns flat quaternion values for a QuaternionKeyframeTrack
function yawQuaternions(yaws) {
  const q = new THREE.Quaternion();
  return yaws.flatMap((yaw) => q.setFromAxisAngle(up, yaw).toArray());
}

// Builds the van's patrol clip: east along one lane, U-turn, west along the other, U-turn
function vanClip() {
  const T = AMBIENT.vanLoopS;
  const leg = T * 0.455;                                   // time per straight
  const turn = (T - 2 * leg) / 2;                          // time per U-turn
  const [west, east] = [-88, 98];
  const times = [0, leg, leg + turn / 2, leg + turn, 2 * leg + turn, 2 * leg + 1.5 * turn, T];
  const positions = [
    west, 0, ROAD_Z_M - LANE_M, east, 0, ROAD_Z_M - LANE_M, east + 3, 0, ROAD_Z_M,
    east, 0, ROAD_Z_M + LANE_M, west, 0, ROAD_Z_M + LANE_M, west - 3, 0, ROAD_Z_M, west, 0, ROAD_Z_M - LANE_M,
  ];
  const yaws = [Math.PI / 2, Math.PI / 2, 0, -Math.PI / 2, -Math.PI / 2, -Math.PI, -1.5 * Math.PI];
  return new THREE.AnimationClip('patrol', T, [
    new THREE.VectorKeyframeTrack('.position', times, positions),
    new THREE.QuaternionKeyframeTrack('.quaternion', times, yawQuaternions(yaws)),
  ]);
}

// Builds the drone's survey clip over the PV rows (smooth interpolation between waypoints)
function droneClip() {
  const { center } = WORLD.solarArray;
  const y = AMBIENT.droneAltitudeM;
  const [x0, x1] = [center[0] - 52, center[0] + 52];
  const lanes = [-30, -15, 0, 15, 30].map((dz) => center[1] + dz);
  const points = [];
  lanes.forEach((z, i) => points.push(...(i % 2 ? [x1, y, z, x0, y, z] : [x0, y, z, x1, y, z])));
  points.push(x0, y + 8, center[1] + 45, points[0], points[1], points[2]);   // climb out, return to start
  const count = points.length / 3;
  const times = Array.from({ length: count }, (_, i) => (i * AMBIENT.droneLoopS) / (count - 1));
  const track = new THREE.VectorKeyframeTrack('.position', times, points, THREE.InterpolateSmooth);
  return new THREE.AnimationClip('survey', AMBIENT.droneLoopS, [track]);
}

// Takes the scene; returns { update(dtSec, timeSec) }
export function createAmbient(scene) {
  const van = createVehicle({ bodyColor: '#d9dcd6', decal: 'SITE SERVICES' });
  const drone = createDroneModel({ scale: SURVEY_DRONE_SCALE });
  scene.add(van.root, drone.group);

  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(vanClip(), van.root).play();
  mixer.clipAction(droneClip(), drone.group).play();

  let wheelAngle = 0;
  return {
    update(dtSec, timeSec) {
      mixer.update(dtSec);
      wheelAngle += (VAN_SPEED_MS / VEHICLE.wheelRadiusM) * dtSec;
      for (let i = 0; i < van.wheels.length; i++) van.wheels[i].spin.rotation.x = wheelAngle;
      van.beaconMat.emissiveIntensity = timeSec % 1 < 0.5 ? 6 : 0.5;
      drone.animate(timeSec);
    },
  };
}
