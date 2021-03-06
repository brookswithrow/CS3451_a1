///<reference path='./whammy.d.ts'/>

// whammy is a simple javascript library for creating .webm movies in the browser
import whammy = require("whammy");

// classes from the Typescript RayTracer sample
class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static background = Color.black;
    static defaultColor = Color.black;
    static toDrawingColor(c: Color) {
        var legalize = d => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

class Camera {
    public forward: Vector;
    public right: Vector;
    public up: Vector;
    public distance: number;
    public hsize: number;
    public vsize: number

    constructor(public pos: Vector, lookAt: Vector, distance: number, hsize: number, vsize: number) {
        var down = new Vector(0.0, -1.0, 0.0);
        this.forward = Vector.norm(Vector.minus(lookAt, this.pos));
        this.right = Vector.times(hsize, Vector.norm(Vector.cross(this.forward, down)));
        this.up = Vector.times(vsize, Vector.norm(Vector.cross(this.forward, this.right)));
        this.distance = distance;
        this.hsize = hsize;
        this.vsize = vsize;
    }
}

interface Ray {
    start: Vector;
    dir: Vector;
}

interface Intersection {
    thing: Thing;
    ray: Ray;
    dist: number;
}

interface Surface {
    diffuse: (pos: Vector) => Color;
    specular: (pos: Vector) => Color;
    reflect: (pos: Vector) => number;
    roughness: number;
}

interface Thing {
    intersect: (ray: Ray, time: number) => Intersection;
    normal: (pos: Vector, time: number) => Vector;
    surface: Surface;
}

interface Light {
    pos: Vector;
    color: Color;
}

interface Scene {
    things: Thing[];
    lights: Light[];
    camera: Camera;
}

class Sphere implements Thing {
    public radius2: number;

    constructor(public center: Vector, radius: number, public surface: Surface) {
        this.radius2 = radius * radius;
    }
    normal(pos: Vector, time: number): Vector { return Vector.norm(Vector.minus(pos, this.center)); }
    intersect(ray: Ray, time: number) {
        var eo = Vector.minus(this.center, ray.start);
        var v = Vector.dot(eo, ray.dir);
        var dist = 0;
        if (v >= 0) {
            var disc = this.radius2 - (Vector.dot(eo, eo) - v * v);
            if (disc >= 0) {
                dist = v - Math.sqrt(disc);
            }
        }
        if (dist === 0) {
            return null;
        } else {
            return { thing: this, ray: ray, dist: dist };
        }
    }
    getCenter(time: number) {
        return this.center;
    }
}

class MovingSphere implements Thing {
        public radius2: number;

    constructor(public center: Vector, radius: number, public surface: Surface) {
        this.radius2 = radius * radius;
    }
    normal(pos: Vector, time: number): Vector { return Vector.norm(Vector.minus(pos, this.getCenter(time))); }
    intersect(ray: Ray, time: number) {
        var eo = Vector.minus(this.getCenter(time), ray.start);
        var v = Vector.dot(eo, ray.dir);
        var dist = 0;
        if (v >= 0) {
            var disc = this.radius2 - (Vector.dot(eo, eo) - v * v);
            if (disc >= 0) {
                dist = v - Math.sqrt(disc);
            }
        }
        if (dist === 0) {
            return null;
        } else {
            return { thing: this, ray: ray, dist: dist };
        }
    }
    getCenter(time: number): Vector {
        var sphereCenter = Vector.times(1.0, this.center);
        var angle = (((2 * Math.PI) / 2) / 10) * (10 * 2 - time)
        var sin = Math.sin(angle);
        sin = Math.pow(sin, 3);
        
        sphereCenter.x = this.center.x + sin * 2;
        return sphereCenter
    }
}

class Plane implements Thing {
    public normal: (pos: Vector, time: number) =>Vector;
    public intersect: (ray: Ray, time: number) =>Intersection;
    constructor(norm: Vector, offset: number, public surface: Surface) {
        this.normal = function(pos: Vector) { return norm; }
        this.intersect = function(ray: Ray): Intersection {
            var denom = Vector.dot(norm, ray.dir);
            if (denom > 0) {
                return null;
            } else {
                var dist = (Vector.dot(norm, ray.start) + offset) / (-denom);
                return { thing: this, ray: ray, dist: dist };
            }
        }
    }
}

module Surfaces {
    export var shiny: Surface = {
        diffuse: function(pos) { return Color.white; },
        specular: function(pos) { return Color.grey; },
        reflect: function(pos) { return 0.7; },
        roughness: 250
    }
    export var checkerboard: Surface = {
        diffuse: function(pos) {
            if ((Math.floor(pos.z) + Math.floor(pos.x)) % 2 !== 0) {
                return Color.white;
            } else {
                return Color.black;
            }
        },
        specular: function(pos) { return Color.white; },
        reflect: function(pos) {
            if ((Math.floor(pos.z) + Math.floor(pos.x)) % 2 !== 0) {
                return 0.1;
            } else {
                return 0.7;
            }
        },
        roughness: 150
    }
}


class RayTracer {
    private maxDepth = 5;

    private intersections(ray: Ray, scene: Scene, time: number) {
        var closest = +Infinity;
        var closestInter: Intersection = undefined;
        for (var i in scene.things) {
            var inter = scene.things[i].intersect(ray, time);
            if (inter != null && inter.dist < closest) {
                closestInter = inter;
                closest = inter.dist;
            }
        }
        return closestInter;
    }

    private testRay(ray: Ray, scene: Scene, time: number) {
        var isect = this.intersections(ray, scene, time);
        if (isect != null) {
            return isect.dist;
        } else {
            return undefined;
        }
    }

    private traceRay(ray: Ray, scene: Scene, depth: number, time: number): Color {
        var isect = this.intersections(ray, scene, time);
        if (isect === undefined) {
            return Color.background;
        } else {
            return this.shade(isect, scene, depth, time);
        }
    }

    private shade(isect: Intersection, scene: Scene, depth: number, time: number) {
        var d = isect.ray.dir;
        var pos = Vector.plus(Vector.times(isect.dist, d), isect.ray.start);
        var normal = isect.thing.normal(pos, time);
        var reflectDir = Vector.minus(d, Vector.times(2, Vector.times(Vector.dot(normal, d), normal)));
        var naturalColor = Color.plus(Color.background,
                                      this.getNaturalColor(isect.thing, pos, normal, reflectDir, scene, time));
        var reflectedColor = (depth >= this.maxDepth) ? Color.grey : this.getReflectionColor(isect.thing, pos, normal, reflectDir, scene, depth, time);
        return Color.plus(naturalColor, reflectedColor);
    }

    private getReflectionColor(thing: Thing, pos: Vector, normal: Vector, rd: Vector, scene: Scene, depth: number, time: number) {
        return Color.scale(thing.surface.reflect(pos), this.traceRay({ start: pos, dir: rd }, scene, depth + 1, time));
    }

    private getNaturalColor(thing: Thing, pos: Vector, norm: Vector, rd: Vector, scene: Scene, time: number) {
        var addLight = (col, light) => {
            var ldis = Vector.minus(light.pos, pos);
            var livec = Vector.norm(ldis);
            var neatIsect = this.testRay({ start: pos, dir: livec }, scene, time);
            var isInShadow = (neatIsect === undefined) ? false : (neatIsect <= Vector.mag(ldis));
            if (isInShadow) {
                return col;
            } else {
                var illum = Vector.dot(livec, norm);
                var lcolor = (illum > 0) ? Color.scale(illum, light.color)
                                          : Color.defaultColor;
                var specular = Vector.dot(livec, Vector.norm(rd));
                var scolor = (specular > 0) ? Color.scale(Math.pow(specular, thing.surface.roughness), light.color)
                                          : Color.defaultColor;
                return Color.plus(col, Color.plus(Color.times(thing.surface.diffuse(pos), lcolor),
                                                  Color.times(thing.surface.specular(pos), scolor)));
            }
        }
        return scene.lights.reduce(addLight, Color.defaultColor);
    }

    // end of unmodified functions from the Typescript RayTracing sample

    // The sample render() function has been modified from the original typescript sample in two ways.
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it takes addition parameters to allow it to render a smaller # of pixels that the size
    //    of the canvas
    // 3. it takes in a Whammy.Video object and some parameters to render a movie from a sequence
    //    of frames
    render(scene, encoder: Whammy.Video, length: number, fps: number,
                ctx : CanvasRenderingContext2D, 
                screenWidth, screenHeight, canvasWidth, canvasHeight, grid: number) {
        var getPoint = (x, y, camera) => {
            var recenterX = x =>((x*(camera.hsize/screenWidth) - (camera.hsize / 2.0)) / (camera.hsize / 2.0))/4;
            var recenterY = y => - ((y*(camera.vsize/screenHeight) - (camera.vsize / 2.0)) / (camera.vsize / 2.0))/4;
            return Vector.norm(Vector.plus(Vector.times(camera.distance, camera.forward), Vector.plus(Vector.times(recenterX(x), camera.right), Vector.times(recenterY(y), camera.up))));
        }
        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = canvasWidth / screenWidth;
        var pixelHeight = canvasHeight / screenHeight;
        var y = 0;
 
        // how many frames       
        var frame = length * fps;
       

        var renderRow = () => {
            for (var x = 0; x < screenWidth; x++) {
                var r = 0;
                var g = 0;
                var b = 0;
                for (var p = 0; p < grid; p++) {
                    for (var q = 0; q < grid; q++) {
                        var rx = Math.random();
                        var ry = Math.random();
                        var c = this.traceRay({ start: scene.camera.pos, dir: getPoint(x+((p+rx)/grid), y+((ry+q)/grid), scene.camera) }, scene, 0, frame + Math.random());
                        r += c.r;
                        g += c.g;
                        b += c.b;
                    }
                }
                r = r / Math.pow(grid, 2);
                g = g / Math.pow(grid, 2);
                b = b / Math.pow(grid, 2);
                var color = new Color(r, g, b);
                var c = Color.toDrawingColor(color);
                ctx.fillStyle = "rgb(" + String(c.r) + ", " + String(c.g) + ", " + String(c.b) + ")";
                ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth, pixelHeight);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                // finished current frame, let see if we have more to render
                if (frame > 0) {
                    // add last frame to the video
                    encoder.add(ctx);
                    
                    // increment frame, restart the line counter
                    y = 0;
                    frame--;
                    
                    // start the next frame         
                    requestAnimationFrame(renderRow);            
                } else {
                    
                    // we are completely done, create the video and add to video element
                    var outputVideo = <HTMLVideoElement> document.getElementById('output');
                    if (outputVideo) {
                        var blob: Blob = <Blob> encoder.compile(false);
                        var url = URL.createObjectURL(blob);
                        outputVideo.src = url;
                    }
                }
            }
        }

        renderRow();
    }
}

function defaultScene(): Scene {
    return {
        things: [new Plane(new Vector(0.0, 1.0, 0.0), 0.0, Surfaces.checkerboard),
                 new MovingSphere(new Vector(0.0, 1.0, -0.25), 1.0, Surfaces.shiny),
                 new Sphere(new Vector(-1.0, 0.5, 1.5), 0.5, Surfaces.shiny)],
        lights: [{ pos: new Vector(-2.0, 2.5, 0.0), color: new Color(0.49, 0.07, 0.07) },
                 { pos: new Vector(1.5, 2.5, 1.5), color: new Color(0.07, 0.07, 0.49) },
                 { pos: new Vector(1.5, 2.5, -1.5), color: new Color(0.07, 0.49, 0.071) },
                 { pos: new Vector(0.0, 3.5, 0.0), color: new Color(0.21, 0.21, 0.35) }],
        camera: new Camera(new Vector(3.0, 2.0, 4.0), new Vector(-1.0, 0.5, 0.0), 2.5, 4, 3)
    };
}

function myScene(): Scene {
    return {
        things: [new Plane(new Vector(0.0, 1.0, 0.0), 0.0, Surfaces.checkerboard),
                 new MovingSphere(new Vector(1.0, 1.0, -1.0), 1.0, Surfaces.shiny),
                 new MovingSphere(new Vector(1.0, 1.0, 1.0), 1.0, Surfaces.shiny)],
        lights: [{ pos: new Vector(-2.0, 2.5, 0.0), color: new Color(0.0, 0.0, 0.4) },
                 { pos: new Vector(1.5, 2.5, 1.5), color: new Color(0.0, 0.4, 0.0) },
                 { pos: new Vector(1.5, 2.5, -1.5), color: new Color(0.4, 0.0, 0.0) }],
        camera: new Camera(new Vector(1.0, 6.0, 0.0), new Vector(0.1, 1.0, 0.0), 0.5, 4, 3)
    };
}


function exec() {
    var canv = document.createElement("canvas");
    canv.width = 640;
    canv.height = 480;
    document.body.appendChild(canv);
    var ctx = canv.getContext("2d");
    var rayTracer = new RayTracer();

    // set up for video recording
    var length = 2;  // seconds
    var fps = 10;
    var encoder = new Whammy.Video(fps);
    
    // start the raytracer
    rayTracer.render(myScene(), encoder, length, fps, ctx, 640, 480, canv.width, canv.height, 4);
}

exec();
