// import declarations: import package
import * as THREE             from 'three';
import { TrackballControls }  from 'three/addons/controls/TrackballControls.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { FontLoader }         from 'three/addons/loaders/FontLoader.js';
import { TextGeometry }       from 'three/addons/geometries/TextGeometry.js';


// globally set variable and constent
let renderer, scene, camera, stats;
let controls;
let mesh, uniforms;

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

let theta, phi;
let radius;
let rotationSpeed;

let scrollAmplitude = 400;   // Define scrollAmplitude here in the global scope
const factor = 2;            // scale factor, how much amount of displacement caused by each scrolling


// font Loading and Initialization
const loader = new FontLoader();
loader.load('fonts/helvetiker_bold.typeface.json', function (font) {

    init(font); // after loading font, execute function init
    animate();  // then execute function animate

});


function init(font) {

    // event listener
    window.addEventListener('keydown', onDocumentKeyDown, false); // when a key is pressed, it will call the onDocumentKeyDown function.


    // set perspective camera
    camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 1, 10000);
    camera.position.set(0, 150, -100);


    // set scene
    scene = new THREE.Scene();
    scene.background = null; // set the background transparent so it doesn't cover photo gallery


    // creat a TextGeometry object
    let geometry = new TextGeometry("Yi-Hsin, I love you.\n  please don't go!", { // THREE.TextGeometry is a specific type of geometry that creates 3D text

        font: font,

        size: 30,
        height: 5,
        curveSegments: 3,

        bevelThickness: 4,
        bevelSize: 1,
        bevelEnabled: true

    });


    // set rotation axis
    geometry.center();


    // tessellate effect
    const tessellateModifier = new TessellateModifier(8, 6);
    geometry = tessellateModifier.modify(geometry);


    // number of faces
    const numFaces = geometry.attributes.position.count / 3;

    const colors = new Float32Array(numFaces * 3 * 3);
    const displacement = new Float32Array(numFaces * 3 * 3);

    const color = new THREE.Color();

    // use loop to create a set of random color and displacement for each face
    for (let f = 0; f < numFaces; f++) {

        const index = 9 * f;

        // set value for hsl color
        const h = 0.2 * Math.random();
        const s = 0.5 + 0.5 * Math.random();
        const l = 0.5 + 0.5 * Math.random();

        color.setHSL(h, s, l);

        const d = 10 * (0.3 - Math.random());

        for (let i = 0; i < 3; i++) {

            colors[index + (3 * i)] = color.r;
            colors[index + (3 * i) + 1] = color.g;
            colors[index + (3 * i) + 2] = color.b;

            displacement[index + (3 * i)] = d;
            displacement[index + (3 * i) + 1] = d;
            displacement[index + (3 * i) + 2] = d;

        }

    }


    // BufferAttribute, an array-like structur object to store vertex information
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('displacement', new THREE.BufferAttribute(displacement, 3));


    //
    uniforms = {

        amplitude: { value: 0.0 }

    };


    // call shader
    const shaderMaterial = new THREE.ShaderMaterial({

        uniforms: uniforms,
        vertexShader: document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent

    });

    //

    mesh = new THREE.Mesh(geometry, shaderMaterial);

    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // set WebGLRenderer with anti-aliasing and transparent canvas 
    renderer.setClearColor(0x000000, 0);                                  // color is black (0x000000) and the opacity is 0, making the background fully transparent.
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(WIDTH, HEIGHT);


    // get container 
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);


    // set TrackballControls
    controls = new TrackballControls(camera, renderer.domElement); // zoom(in out), rotating(angle), panning(plane) based on mouse and keyboard input
    controls.noZoom = true;    // disable the zoom effect because it was overriding the scroll action meant for the displacement
    controls.noPan = true;     // disable panning
    controls.noRotate = true;  // disable rotate


    // Define a variable to store the rotation speed
    rotationSpeed = 0.02; // rotation speed for the camera when arrow keys are pressed


    // based on camera's cartesian coordinates, convert to spherical coordinate
    radius = camera.position.length();
    theta = Math.atan2(camera.position.x, camera.position.z); // azimuthal angle
    phi = Math.acos(camera.position.y / radius);              // polar angle


    // Calculate curve parameters, bounding is the border of the entire text object
    geometry.computeBoundingBox();                                             // Compute the bounding box
    let textWidth = geometry.boundingBox.max.x - geometry.boundingBox.min.x;   // the width of the text object
    let textHeight = geometry.boundingBox.max.y - geometry.boundingBox.min.y;  // the height of the text object
    let curveRadius = camera.position.length();                                // This is the radius we'll use for our curve

    // to deal with perspective distortion, curve the text so that all parts of the text are approximately equidistant from the camera
    let positionAttribute = geometry.attributes.position; 

    // NOTE: geometry is an object
    // NOTE: attributes is a property of geometry, like position, texture, facing
    // NOTE: a vertex is a point in 3D space
    // NOTE: positions contains all the coordinate of each vertices 
    // NOTE: gemoetry.attributes.position is a BufferAttribute object(array) contains position data of all vertices 
    // NOTE: so positionAttribute is a object holding all position of vertex (x, y, z)


    // loop update vertex coordinate
    for (let i = 0; i < positionAttribute.count; i++) {    // loop through every vertex to change their position, positionAttribute.count = vertex count
        let vertex = new THREE.Vector3();                  // create a three-dimensional vector
        
        // old coordinate of the ith vertex
        vertex.fromBufferAttribute(positionAttribute, i);  // 

        // NOTE: vertex is an object
        // NOTE: fromBufferAttribute is a method used to extract vector from BufferAttribute

        
        // set angle for a spherical coordinates for the curve
        let x = vertex.x                 // center the calculations around the middle of the text
        let theta_2 = (x / textWidth) * (0.4 * Math.PI) + 0.5 * Math.PI;  // the value theta_2 determine how much to "curve" this vertex
        
        // NOTE: because there are totally 2pi for a circle
        // NOTE: x divided by textWidth, get a normalized value between 0 and 1, means where the vertex is located from the left to the right of the text 
        // NOTE: coefficient of pi decided the strength of curve
        // NOTE: + 0.5 make the angle center at 0.5 pi, that is, the positive y axis on a 2D plane
        // NOTE: which makes theta_2 range from -0.5*0.4pi~+0.5*0.4pi


        // new coordinate, update from old coordinate based on 
        vertex.z = curveRadius * Math.sin(theta_2);                // depth dimension
        vertex.x = curveRadius * Math.cos(theta_2);                // horizontal dimension
        vertex.y = vertex.y * 0.7;                                 // adjust the height of the text

        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z); // applying the new position to the ith vertex in the geometry
    }
}


// update the camera's spherical coordinates 
function onDocumentKeyDown(event) {
    event.preventDefault();  // Add this line to prevent the default behavior of the keys
    var keyCode = event.which;

    // adjust angles phi only based on arrow key
    if (keyCode == 38) {     // 38 is the up arrow key
        phi -= rotationSpeed;
    } else if (keyCode == 40) {     // 40 is the down arrow key
        phi += rotationSpeed;
    
    // update scrollAmplitude based on pg up or down
    } else if (keyCode == 33) {     // 33 is the Page Up key
        scrollAmplitude += factor;  // Increase the displacement distance
    } else if (keyCode == 34) {     // 34 is the Page Down key
        scrollAmplitude -= factor;  // Decrease the displacement distance
    }

    // Ensure that phi is within [-pi/2, pi/2] so camera doesn't flip over
    phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phi));


    // convert spherical coordinates to 3D coordinate system, Calculate the new camera position
    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = radius * Math.cos(phi);
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);


    // Make the camera look at the origin
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // set the focus point of the camera, tell the camera where to look at
}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}


function animate() {

    requestAnimationFrame(animate); // loop performing animate

    render();


}


// renderer
function render() {

    uniforms.amplitude.value = 0 + scrollAmplitude; // update uniforms.amplitude.value every frame by scrollAmplitude in onWindowScroll 
    
    renderer.setClearColor(0x000000, 0); // the second argument is the alpha (transparency)

    controls.update();
    renderer.render(scene, camera);
}

