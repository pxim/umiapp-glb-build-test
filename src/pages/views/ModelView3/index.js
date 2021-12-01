import {
    AmbientLight,
    AnimationMixer,
    AxesHelper,
    Box3,
    Cache,
    CubeTextureLoader,
    DirectionalLight,
    GridHelper,
    HemisphereLight,
    LinearEncoding,
    LoaderUtils,
    LoadingManager,
    PMREMGenerator,
    PerspectiveCamera,
    RGBFormat,
    Scene,
    SkeletonHelper,
    UnsignedByteType,
    Vector3,
    WebGLRenderer,
    sRGBEncoding,
    LoopOnce,
    TextureLoader, FloatType,
  } from 'three';
  import Stats from 'three/examples/jsm/libs/stats.module.js';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
  import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
  import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import {DragControls} from "three/examples/jsm/controls/DragControls";
  import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
  // import { RoughnessMipmapper } from 'three/examples/jsm/utils/RoughnessMipmapper.js';
  import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
  
  import * as THREE from 'three';
  
  import { GUI } from 'dat.gui'; 
  import './style.css';
  
//   import { environments } from '../assets/environment/index.js';
//   import { createBackground } from '../lib/three-vignette.js';
  import {TextureCubeNode} from "three/examples/jsm/nodes/misc/TextureCubeNode";
  
  const DEFAULT_CAMERA = '[default]';
  
  const IS_IOS = isIOS();

  const environments = [
    {
      id: '',
      name: 'None',
      path: 'assets/envmap.hdr',
      format: '.hdr'
    },
    {
      id: 'room',
      name: 'room',
      path: 'assets/envmap.hdr',
      format: '.hdr'
    }
  ];
  
  
  // glTF texture types. `envMap` is deliberately omitted, as it's used internally
  // by the loader but not part of the glTF format.
  const MAP_NAMES = [
    'map',
    'aoMap',
    'emissiveMap',
    'glossinessMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'specularMap',
  ];
  
  const Preset = {ASSET_GENERATOR: 'assetgenerator'};
  
  Cache.enabled = true;
  
  export class Viewer {
  
    constructor (el, options) {
      this.el = el;
  
      this.lights = [];
      this.content = null;
      this.mixer = null;
      this.clips = [];
      this.gui = null;
  
      this.state = {
        environment:  environments[1].name,
        background: false,
        playbackSpeed: 1.0,
        actionStates: {},
        camera: DEFAULT_CAMERA,
        wireframe: false,
        skeleton: false,
        grid: false,
  
        // Lights
        addLights: true, //true
        exposure: 1.0,
        textureEncoding: 'sRGB',
        ambientIntensity: 0.3,
        ambientColor: 0xFFFFFF,
        directIntensity: 0.25 * Math.PI, //0.8  TODO(#116)
        directColor: 0xFFFFFF,
        bgColor1: '#ffffff',
        bgColor2: '#353535',
  
        //render
        physicallyCorrectLights: true,
  
        uploadEnvMap: false,
        mode: 'rotate', // OrbitControls  DragControls
      };
  
      this.prevTime = 0;
  
      this.stats = new Stats();
      this.stats.dom.height = '48px';
      [].forEach.call(this.stats.dom.children, (child) => (child.style.display = ''));
  
      this.scene = new Scene();
  
      const fov =  60;
      this.defaultCamera = new PerspectiveCamera( fov, window.innerWidth / window.innerHeight, 0.01, 1000 );
      this.activeCamera = this.defaultCamera;
      this.scene.add( this.defaultCamera );
  
      this.renderer = window.renderer = new WebGLRenderer({antialias: true});
      // this.renderer.physicallyCorrectLights = true;
      this.renderer.physicallyCorrectLights = this.state.physicallyCorrectLights;
      this.renderer.outputEncoding = sRGBEncoding;
      this.renderer.setClearColor( 0xcccccc );
      this.renderer.setPixelRatio( window.devicePixelRatio );
      this.renderer.setSize( window.innerWidth, window.innerHeight );
  
      this.pmremGenerator = new PMREMGenerator( this.renderer );
      this.pmremGenerator.compileEquirectangularShader();
      // this.scene.environment = this.pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
  
      this.controls = new OrbitControls( this.defaultCamera, this.renderer.domElement );
      this.controls.autoRotate = false;
      this.controls.autoRotateSpeed = -10;
      this.controls.screenSpacePanning = true;
  
      // this.vignette = createBackground({
      //   aspect: this.defaultCamera.aspect,
      //   grainScale: IS_IOS ? 0 : 0.001, // mattdesl/three-vignette-background#1
      //   colors: [this.state.bgColor1, this.state.bgColor2]
      // });
      // this.vignette.name = 'Vignette';
      // this.vignette.renderOrder = -1;
  
      this.el.appendChild(this.renderer.domElement);
  
      this.cameraCtrl = null;
      this.cameraFolder = null;
      this.animFolder = null;
      this.animCtrls = [];
      this.morphFolder = null;
      this.morphCtrls = [];
      this.skeletonHelpers = [];
      this.gridHelper = null;
      this.axesHelper = null;
  
      this.addAxesHelper();
      this.addGUI();
  
      this.animate = this.animate.bind(this);
      requestAnimationFrame( this.animate );
      window.addEventListener('resize', this.resize.bind(this), false);
  
      window.addEventListener('message', this.onWinMsg.bind(this), false);
    }
  
    animate (time) {
  
      requestAnimationFrame( this.animate );
  
      const dt = (time - this.prevTime) / 1000;
  
      this.controls.update();
      this.stats.update();
      this.mixer && this.mixer.update(dt);
      this.render();
  
      this.prevTime = time;
  
    }
  
    render () {
  
      this.renderer.render( this.scene, this.activeCamera );
      if (this.state.grid) {
        this.axesCamera.position.copy(this.defaultCamera.position)
        this.axesCamera.lookAt(this.axesScene.position)
        this.axesRenderer.render( this.axesScene, this.axesCamera );
      }
    }
  
    resize () {
  
    //   const {clientHeight, clientWidth} = this.el.parentElement;
      const clientHeight =  window.innerWidth;
      const clientWidth =  window.innerHeight;

      this.defaultCamera.aspect = clientWidth / clientHeight;
      this.defaultCamera.updateProjectionMatrix();
      // this.vignette.style({aspect: this.defaultCamera.aspect});
      this.renderer.setSize(clientWidth, clientHeight);
  
      this.axesCamera.aspect = this.axesDiv.clientWidth / this.axesDiv.clientHeight;
      this.axesCamera.updateProjectionMatrix();
      this.axesRenderer.setSize(this.axesDiv.clientWidth, this.axesDiv.clientHeight);
    }
  
    load ( url, rootPath, assetMap ) {
  
      const baseURL = LoaderUtils.extractUrlBase(url);
  
      // Load.
      return new Promise((resolve, reject) => {
  
        const manager = new LoadingManager();
  
        // Intercept and override relative URLs.
        manager.setURLModifier((url, path) => {
  
          // URIs in a glTF file may be escaped, or not. Assume that assetMap is
          // from an un-escaped source, and decode all URIs before lookups.
          // See: https://github.com/donmccurdy/three-gltf-viewer/issues/146
          const normalizedURL = rootPath + decodeURI(url)
            .replace(baseURL, '')
            .replace(/^(\.?\/)/, '');
  
          if (assetMap.has(normalizedURL)) {
            const blob = assetMap.get(normalizedURL);
            const blobURL = URL.createObjectURL(blob);
            blobURLs.push(blobURL);
            return blobURL;
          }
  
          return (path || '') + url;
  
        });
  
        const loader = new GLTFLoader( manager )
          .setCrossOrigin('anonymous')
          .setDRACOLoader(
            new DRACOLoader( manager ).setDecoderPath( 'assets/wasm/' )
          )
          .setKTX2Loader(
            new KTX2Loader( manager )
              .setTranscoderPath( 'assets/wasm/' )
              .detectSupport( this.renderer )
          )
          .setMeshoptDecoder( MeshoptDecoder );
  
        const blobURLs = [];
  
        loader.load(url, (gltf) => {
  
          const scene = gltf.scene || gltf.scenes[0];
          const clips = gltf.animations || [];
  
          if (!scene) {
            // Valid, but not supported by this viewer.
            throw new Error(
              'This model contains no scene, and cannot be viewed here. However,'
              + ' it may contain individual 3D resources.'
            );
          }
  
          this.setContent(scene, clips);
  
          blobURLs.forEach(URL.revokeObjectURL);
  
          // See: https://github.com/google/draco/issues/349
          // DRACOLoader.releaseDecoderModule();
  
          resolve(gltf); 
  
        }, (xhr)=>{
          // const x1 = 0;
          console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        }, reject);
  
      });
  
    }
  
    /**
     * @param {THREE.Object3D} object
     * @param {Array<THREE.AnimationClip} clips
     */
    setContent ( object, clips ) {
  
      this.clear();
  
      const box = new Box3().setFromObject(object);
      const size = box.getSize(new Vector3()).length();
      const center = box.getCenter(new Vector3());
  
      this.controls.reset();
  
      object.position.x += (object.position.x - center.x);
      object.position.y += (object.position.y - center.y);
      object.position.z += (object.position.z - center.z);
      this.controls.maxDistance = size * 10;
      this.defaultCamera.near = size / 100;
      this.defaultCamera.far = size * 100;
      this.defaultCamera.updateProjectionMatrix();
  
   
        this.defaultCamera.position.copy(center);
        this.defaultCamera.position.x += size / 2.0;
        this.defaultCamera.position.y += size / 5.0;
        this.defaultCamera.position.z += size / 2.0;
        this.defaultCamera.lookAt(center);

  
      this.setCamera(DEFAULT_CAMERA);
  
      this.axesCamera.position.copy(this.defaultCamera.position)
      this.axesCamera.lookAt(this.axesScene.position)
      this.axesCamera.near = size / 100;
      this.axesCamera.far = size * 100;
      this.axesCamera.updateProjectionMatrix();
      this.axesCorner.scale.set(size, size, size);
  
      this.controls.saveState();
  
      this.scene.add(object);
      this.content = object;
  
      this.state.addLights = true;
      // this.state.addLights = false;
  
      this.content.traverse((node) => {
        if (node.isLight) {
          this.state.addLights = false;
        } else if (node.isMesh) {
          // TODO(https://github.com/mrdoob/three.js/pull/18235): Clean up.
          node.material.depthWrite = !node.material.transparent;
        }
      });
  
      this.setClips(clips);
  
      this.updateLights();
      this.updateGUI();
      this.updateEnvironment();
      this.updateTextureEncoding();
      this.updateDisplay();
  
      window.content = this.content;
      console.info('[glTF Viewer] THREE.Scene exported as `window.content`.');
      this.printGraph(this.content);
  
      this.mObjArr = this.collectObj(this.content) || [];
      // this.addTree(this.mObjArr);
      // const folder = this.gui.addFolder('ModelList');
  
      if(window.parent !== window){window.parent.postMessage(JSON.stringify({type:'ModelList', data:this.mObjArr}), "*");}
  
      this.dragContr = new DragControls( [object], this.defaultCamera, this.renderer.domElement );
      this.dragContr.transformGroup = true;
      // this.dragContr.enabled = false;
  
      this.controls.enablePan = false;
      this.dragContr.addEventListener( 'dragstart',  ( event )=> {
        this.controls.enabled = false;
      } );
      this.dragContr.addEventListener( 'dragend',  ( event )=> {
        this.controls.enabled = true;
      } );
      this.dragContr.addEventListener( 'drag',  ( event )=> {
        this.updateData();
      } );
      this.controls.addEventListener('start', ()=>{
      })
      this.controls.addEventListener('end', ()=>{
      })
      this.controls.addEventListener('change', ()=>{
        this.updateData();
      })
  
      // window.setTimeout(()=>{
      //   this.setInitData();
      // }, 1000)
    }
  
    printGraph (node) {
      console.group(' <' + node.type + '> ' + node.name);
      node.children.forEach((child) => this.printGraph(child));
      console.groupEnd();
    }
    setModelStats(report) {
      const info = report.info;
       const str =
                       'draw calls: ' + info.drawCallCount
           + '<br />' +'animations: '+ info.animationCount
           + '<br />' +'materials : '+ info.materialCount
           + '<br />' +'vertices  : '+ info.totalVertexCount
           + '<br />' +'triangles : '+ info.totalTriangleCount
  
      this.modelStatsLabel.innerHTML = str;
    }
    updateData() {
      const obj = [
        this.controls.getAzimuthalAngle(), //获得当前的水平旋转，单位为弧度。
        this.controls.getPolarAngle(),     //获得当前的垂直旋转，单位为弧度。
        // distance,                     //获得相机内外移动距离（仅适用于PerspectiveCamera），单位为Float。
        this.controls.getDistance(),
      ];
      const str =
          '水平旋转 ' + obj[0]
          + '<br />' +'垂直旋转 '+ obj[1]
          + '<br />' +'内外移动 '+ obj[2]
  
          + '<br />' + '<hr />' + '相机旋转X：' + this.defaultCamera.rotation.x
          + '<br />' + '相机旋转Y：' + this.defaultCamera.rotation.y
          + '<br />' + '相机旋转Z：' + this.defaultCamera.rotation.z
  
          + '<br />' + '相机坐标X：' + this.defaultCamera.position.x
          + '<br />' + '相机坐标Y：' + this.defaultCamera.position.y
          + '<br />' + '相机坐标Z：' + this.defaultCamera.position.z
  
          + '<br />' + '模型坐标X：' + this.content.position.x
          + '<br />' + '模型坐标Y：' + this.content.position.y
          + '<br />' + '模型坐标Z：' + this.content.position.z
  
      this.modeRotateLabel.innerHTML = str;
  
      // console.log(this.defaultCamera);
    }
    setInitData() {
      // 相机坐标X：8.551489292552473
      // 相机坐标Y：9.310037279265588
      // 相机坐标Z：7.187416413832269
      // 相机旋转X：-0.9301918064933675
      // 相机旋转Y：1.067346163083514
      // 相机旋转Z：0.8656735331631727
      // 模型坐标X：0.05400459798257323
      // 模型坐标Y：-0.19968166692657302
      // 模型坐标Z：-0.11689469166091576
  
      this.defaultCamera.position.x = 8.551489292552473;
      this.defaultCamera.position.y = 9.310037279265588;
      this.defaultCamera.position.z = 7.187416413832269;
  
      this.defaultCamera.rotation.x = -0.9301918064933675;
      this.defaultCamera.rotation.y = 1.067346163083514;
      this.defaultCamera.rotation.z = 0.8656735331631727;
  
      // this.defaultCamera.quaternion.x = -0.31501013215382323
      // this.defaultCamera.quaternion.y = 0.45816141576842895
      // this.defaultCamera.quaternion.z = 0.17775193969627015
      // this.defaultCamera.quaternion.w = 0.8119488787329613
  
      // this.content.position.x = 2.081583748801746;
      // this.content.position.y = -8.233432408976338;
      // this.content.position.z = -6.624102126703449;
  
      this.controls.update();
    }
    saveInitViewAngle() {
      const data = { 
        "cameraRotation": {
          "x": this.defaultCamera.rotation.x,
          "y": this.defaultCamera.rotation.y,
          "z": this.defaultCamera.rotation.z
        },
        "cameraPosition": {
          "x": this.defaultCamera.position.x,
          "y": this.defaultCamera.position.y,
          "z": this.defaultCamera.position.z
        }
       }
      if(window.parent !== window){window.parent.postMessage(JSON.stringify({type:'InitView', data:data}), "*");}
    }
    saveAnimViewAngle() {
      const data = {
        "cameraRotation": {
          "x": this.defaultCamera.rotation.x,
          "y": this.defaultCamera.rotation.y,
          "z": this.defaultCamera.rotation.z
        },
        "cameraPosition": {
          "x": this.defaultCamera.position.x,
          "y": this.defaultCamera.position.y,
          "z": this.defaultCamera.position.z
        },
        "modelPosition": {
          "x": this.content.position.x,
          "y": this.content.position.y,
          "z": this.content.position.z
        }
      }
      if(window.parent !== window){window.parent.postMessage(JSON.stringify({type:'AnimView', data:data}), "*");}
    }
  
    collectObj (node) {
      // const tempAry = node.children.map((child)=>{
      //   return {key:child.name, nid:child.uuid, children: child.children}
      // })
  
      const tempAry = node.children;
  
      const onEach = (ary)=>{
        const ary2 =  ary.map((child)=>{
          const item = {key:child.uuid ||child.nid , title:'<' + child.type + '>' + child.name ||child.title,}
          if(child.children){item.children = child.children}
          return item;
        })
  
        ary2.forEach((item)=>{
          // item.key = item.name;
          // item.nid = item.uuid;  //显示
  
          if(item.children){
            const x = onEach(item.children);
            item.children = x;
          }
        });
  
        return ary2;
      };
      const x1 = onEach(tempAry);
      return x1;
    }
    onWinMsg(event) {
      const isJson = this.isJSON(event.data); if (!isJson) { return; }
      const param = JSON.parse(event.data);
      switch (param.type) {
        case 'model_node_checked' :
          this.setObjectVisible(this.content, true);
          this.handleCheckedObject(param.data);
          // console.log(param);
          break;
        case 'gltf_report' :
          this.setModelStats(param.data);
          break;
        default :
          break;
      }
    }
    handleCheckedObject(arr) {
      arr = arr || [];
      arr.forEach((child)=>{
        const node = this.content.getObjectByProperty('uuid', child);
        if(!node){return false;}
        console.log(node);
        this.setObjectVisible(node, false);
      })
    }
    setObjectVisible(nItem, bool) {
      const layer = bool ? 0 : 2;
      nItem.traverse((child)=>{
        child.layers.set(layer);
      })
    }
    isJSON(str) {
      if (typeof str == 'string') {
        try {
          let obj=JSON.parse(str);
          if(typeof obj == 'object' && obj ){
            return true;
          }else{
            return false;
          }
  
        } catch(e) {
          // console.log('It is not a JSON!' +'\n'+'error：'+str +'\n'+e);
          return false;
        }
      }
      return false;
      // console.log('It is not a string!');
    }
  
    /**
     * @param {Array<THREE.AnimationClip} clips
     */
    setClips ( clips ) {
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.mixer.getRoot());
        this.mixer = null;
      }
  
      this.clips = clips;
      if (!clips.length) return;
  
      this.mixer = new AnimationMixer( this.content );
    }
  
    playAllClips () {
      this.clips.forEach((clip) => {
        this.mixer.clipAction(clip).reset().play();
        this.state.actionStates[clip.name] = true;
      });
    }
  
    /**
     * @param {string} name
     */
    setCamera ( name ) {
      if (name === DEFAULT_CAMERA) {
        this.controls.enabled = true;
        this.activeCamera = this.defaultCamera;
      } else {
        this.controls.enabled = false;
        this.content.traverse((node) => {
          if (node.isCamera && node.name === name) {
            this.activeCamera = node;
          }
        });
      }
    }
  
    updateTextureEncoding () {
      const encoding = this.state.textureEncoding === 'sRGB'
        ? sRGBEncoding
        : LinearEncoding;
      traverseMaterials(this.content, (material) => {
        if (material.map) material.map.encoding = encoding;
        if (material.emissiveMap) material.emissiveMap.encoding = encoding;
        if (material.map || material.emissiveMap) material.needsUpdate = true;
      });
    }
  
    updateLights () {
      const state = this.state;
      const lights = this.lights;
  
      if (state.addLights && !lights.length) {
        this.addLights();
      } else if (!state.addLights && lights.length) {
        this.removeLights();
      }
  
      this.renderer.toneMappingExposure = state.exposure;
  
      if (lights.length === 2) {
        lights[0].intensity = state.ambientIntensity;
        lights[0].color.setHex(state.ambientColor);
        lights[1].intensity = state.directIntensity;
        lights[1].color.setHex(state.directColor);
      }
    }
  
    addLights () {
      const state = this.state;
  
  
      const light1  = new AmbientLight(state.ambientColor, state.ambientIntensity);
      light1.name = 'ambient_light';
      this.defaultCamera.add( light1 );
  
      const light2  = new DirectionalLight(state.directColor, state.directIntensity);
      light2.position.set(0.5, 0, 0.866); // ~60º
      light2.name = 'main_light';
      this.defaultCamera.add( light2 );
  
      this.lights.push(light1, light2);
    }
  
    removeLights () {
  
      this.lights.forEach((light) => light.parent.remove(light));
      this.lights.length = 0;
  
    }
  
    updateEnvironment () {
  
      const environment = environments.filter((entry) => entry.name === this.state.environment)[0];
  
      this.getCubeMapTexture( environment ).then(( { envMap } ) => {
  
        if ((!envMap || !this.state.background) && this.activeCamera === this.defaultCamera) {
          // this.scene.add(this.vignette);
        } else {
          // this.scene.remove(this.vignette);
        }
  
        // this.scene.environment = envMap;
  
        this.scene.environment = envMap || this.pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
        // this.scene.environment = this.state.physicallyCorrectLights ? envMap : this.pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
        // this.scene.background = this.state.background ? envMap : null;
        this.scene.background = this.state.background ? envMap : this.getBgTexture();
      });
  
    }
  
    getBgTexture() {
      const t = new THREE.TextureLoader().load('assets/bg.png', (texture)=>{
        texture.encoding = THREE.sRGBEncoding;
        texture.needsUpdate=true;
      });
      return t;
    }
  
    getCubeMapTexture ( environment ) {
      const { path } = environment;
  
      // no envmap
      if ( ! path ) return Promise.resolve( { envMap: null } );
  
      return new Promise( ( resolve, reject ) => {
  
        new RGBELoader()
          // .setDataType( UnsignedByteType )
          .setDataType(THREE.UnsignedByteType)
          .load( path, ( texture ) => {
  
            const envMap = this.pmremGenerator.fromEquirectangular( texture ).texture;
            this.pmremGenerator.dispose();
  
            resolve( { envMap } );
  
          }, undefined, reject );
  
        // new TextureLoader().load(
        //     // 资源URL
        //     path,
        //
        //     // onLoad回调
        //     function ( texture ) {
        //       const envMap = this.pmremGenerator.fromEquirectangular( texture ).texture;
        //       this.pmremGenerator.dispose();
        //
        //       resolve( { envMap } );
        //     },
        //     // 目前暂不支持onProgress的回调
        //     undefined,
        //     // onError回调
        //     reject
        // );
  
  
      });
  
    }
  
    updateDisplay () {
      if (this.skeletonHelpers.length) {
        this.skeletonHelpers.forEach((helper) => this.scene.remove(helper));
      }
  
      traverseMaterials(this.content, (material) => {
        material.wireframe = this.state.wireframe;
      });
  
      this.content.traverse((node) => {
        if (node.isMesh && node.skeleton && this.state.skeleton) {
          const helper = new SkeletonHelper(node.skeleton.bones[0].parent);
          helper.material.linewidth = 3;
          this.scene.add(helper);
          this.skeletonHelpers.push(helper);
        }
      });
  
      if (this.state.grid !== Boolean(this.gridHelper)) {
        if (this.state.grid) {
          this.gridHelper = new GridHelper();
          this.axesHelper = new AxesHelper();
          this.axesHelper.renderOrder = 999;
          this.axesHelper.onBeforeRender = (renderer) => renderer.clearDepth();
          this.scene.add(this.gridHelper);
          this.scene.add(this.axesHelper);
        } else {
          this.scene.remove(this.gridHelper);
          this.scene.remove(this.axesHelper);
          this.gridHelper = null;
          this.axesHelper = null;
          this.axesRenderer.clear();
        }
      }
    }
  
    updateBackground () {
      // this.vignette.style({colors: [this.state.bgColor1, this.state.bgColor2]});
    }
  
    /**
     * Adds AxesHelper.
     *
     * See: https://stackoverflow.com/q/16226693/1314762
     */
    addAxesHelper () {
      this.axesDiv = document.createElement('div');
      this.el.appendChild( this.axesDiv );
      this.axesDiv.classList.add('axes');
  
      const {clientWidth, clientHeight} = this.axesDiv;
  
      this.axesScene = new Scene();
      this.axesCamera = new PerspectiveCamera( 50, clientWidth / clientHeight, 0.1, 10 );
      this.axesScene.add( this.axesCamera );
  
      this.axesRenderer = new WebGLRenderer( { alpha: true } );
      this.axesRenderer.setPixelRatio( window.devicePixelRatio );
      this.axesRenderer.setSize( this.axesDiv.clientWidth, this.axesDiv.clientHeight );
  
      this.axesCamera.up = this.defaultCamera.up;
  
      this.axesCorner = new AxesHelper(5);
      this.axesScene.add( this.axesCorner );
      this.axesDiv.appendChild(this.axesRenderer.domElement);
    }
  
    addGUI () {
  
      const gui = this.gui = new GUI({autoPlace: false, width: 260, hideable: true});
  
      // Display controls.
      const dispFolder = gui.addFolder('Display');
      const envBackgroundCtrl = dispFolder.add(this.state, 'background');
      envBackgroundCtrl.onChange(() => this.updateEnvironment());
      const wireframeCtrl = dispFolder.add(this.state, 'wireframe');
      wireframeCtrl.onChange(() => this.updateDisplay());
      const skeletonCtrl = dispFolder.add(this.state, 'skeleton');
      skeletonCtrl.onChange(() => this.updateDisplay());
      const gridCtrl = dispFolder.add(this.state, 'grid');
      gridCtrl.onChange(() => this.updateDisplay());
      dispFolder.add(this.controls, 'autoRotate');
      dispFolder.add(this.controls, 'screenSpacePanning');
      const bgColor1Ctrl = dispFolder.addColor(this.state, 'bgColor1');
      const bgColor2Ctrl = dispFolder.addColor(this.state, 'bgColor2');
      bgColor1Ctrl.onChange(() => this.updateBackground());
      bgColor2Ctrl.onChange(() => this.updateBackground());
  
      // Lighting controls.
      const lightFolder = gui.addFolder('Lighting');
      const encodingCtrl = lightFolder.add(this.state, 'textureEncoding', ['sRGB', 'Linear']);
      encodingCtrl.onChange(() => this.updateTextureEncoding());
      lightFolder.add(this.renderer, 'outputEncoding', {sRGB: sRGBEncoding, Linear: LinearEncoding})
        .onChange(() => {
          this.renderer.outputEncoding = Number(this.renderer.outputEncoding);
          traverseMaterials(this.content, (material) => {
            material.needsUpdate = true;
          });
        });
      const envMapCtrl = lightFolder.add(this.state, 'environment', environments.map((env) => env.name));
      envMapCtrl.onChange(() => {
        this.updateEnvironment()
      });
      [
        lightFolder.add(this.state, 'exposure', 0, 2),
        lightFolder.add(this.state, 'addLights').listen(),
        lightFolder.add(this.state, 'ambientIntensity', 0, 2),
        lightFolder.addColor(this.state, 'ambientColor'),
        lightFolder.add(this.state, 'directIntensity', 0, 4), // TODO(#116)
        lightFolder.addColor(this.state, 'directColor')
      ].forEach((ctrl) => ctrl.onChange(() => this.updateLights()));
  
      const renderFolder = gui.addFolder('Renderer');
      const physicallyCorrectLightsCtrl = renderFolder.add(this.state, 'physicallyCorrectLights');
      physicallyCorrectLightsCtrl.onChange((e) => {
        // this.renderer.clear(true,true,true);
        // this.renderer.setClearColor( 0xcccccc );
        // this.renderer.autoClear = true;
        this.renderer.physicallyCorrectLights = this.state.physicallyCorrectLights;
        // this.state.environment = environments[1].name;
  
        const evnMapName = this.state.physicallyCorrectLights ? environments[1].name : environments[0].name;
        envMapCtrl.setValue(evnMapName);
        // this.scene.environment = this.pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;
        // this.renderer.render(this.scene, this.activeCamera);
        // this.updateEnvironment();
      });
  
      const assetsFolder = gui.addFolder('Asset');
      const uploadEnvMapCtrl = assetsFolder.add(this.state, 'uploadEnvMap');
      uploadEnvMapCtrl.onChange((e) => {
        const div = document.querySelector('.dropzone-envmap');
        div.style.display = e ? 'flex' : 'none';
      });
      assetsFolder.open();
  
  
      const contrFolder = gui.addFolder('Controls');
      // const ctrModelCtrl = contrFolder.add(this.state, 'mode', {rotate: 'rotate', drag: 'drag'})
      // ctrModelCtrl.onChange((e)=>{
      //   switch (e) {
      //     case 'rotate' :
      //       this.controls.enableRotate = true;
      //       this.dragContr.enabled = false;
      //       // this.controls.enablePan = false;
      //       // //修改鼠标按键
      //       // this.controls.mouseButtons = {
      //       //   LEFT:THREE.MOUSE.ROTATE,
      //       //   MIDDLE:THREE.MOUSE.DOLLY,
      //       //   RIGHT:THREE.MOUSE.PAN
      //       // }
      //       break;
      //     case 'drag' :
      //       this.controls.enableRotate = false;
      //       // this.controls.enablePan = true;
      //       this.dragContr.enabled = true;
      //       // //修改鼠标按键
      //       // this.controls.mouseButtons = {
      //       //   LEFT:THREE.MOUSE.PAN,
      //       //   MIDDLE:THREE.MOUSE.DOLLY,
      //       //   RIGHT:THREE.MOUSE.ROTATE
      //       // }
      //       break;
      //     default :
      //       break;
      //   }
      // });
  
      const contrFolderLi = document.createElement('li');
      contrFolderLi.style.height = 'auto';
      const modeRotateLabel = document.createElement('div');
      modeRotateLabel.textContent = '';
      contrFolderLi.appendChild(modeRotateLabel);
      // modeRotateLabel.textContent = '1234578910';
      this.modeRotateLabel = modeRotateLabel;
      const initViewBtn = document.createElement('button');
      initViewBtn.textContent = '保存为初始视角';
      initViewBtn.style.cursor = 'pointer';
      initViewBtn.style.marginRight = '15px';
      const animViewBtn = document.createElement('button');
      animViewBtn.textContent = '保存为动画视角';
      animViewBtn.style.cursor = 'pointer';
      contrFolderLi.appendChild(initViewBtn);
      contrFolderLi.appendChild(animViewBtn);
      initViewBtn.addEventListener('mousedown', ()=>{this.saveInitViewAngle();})
      animViewBtn.addEventListener('mousedown', ()=>{this.saveAnimViewAngle();})
      contrFolder.__ul.appendChild( contrFolderLi );
      contrFolder.open();
  
  
      // Animation controls.
      this.animFolder = gui.addFolder('Animation');
      this.animFolder.domElement.style.display = 'none';
      const playbackSpeedCtrl = this.animFolder.add(this.state, 'playbackSpeed', 0, 1);
      playbackSpeedCtrl.onChange((speed) => {
        if (this.mixer) this.mixer.timeScale = speed;
      });
      this.animFolder.add({playAll: () => this.playAllClips()}, 'playAll');
      this.animFolder.open();
  
      // Morph target controls.
      this.morphFolder = gui.addFolder('Morph Targets');
      this.morphFolder.domElement.style.display = 'none';
  
      // Camera controls.
      this.cameraFolder = gui.addFolder('Cameras');
      this.cameraFolder.domElement.style.display = 'none';
  
      // Stats.
      const perfFolder = gui.addFolder('Performance');
      const perfLi = document.createElement('li');
      this.stats.dom.style.position = 'static';
      perfLi.appendChild(this.stats.dom);
      perfLi.classList.add('gui-stats');
      perfFolder.__ul.appendChild( perfLi );
      perfFolder.open();
  
      const guiWrap = document.createElement('div');
      this.el.appendChild( guiWrap );
      guiWrap.classList.add('gui-wrap');
      guiWrap.appendChild(gui.domElement);
      gui.open();
  
      const modelCountFolder = gui.addFolder('ModelCount');
      const modelCountFolderLi = document.createElement('li');
      modelCountFolderLi.style.height = 'auto';
  
      const modelStatsLabel = document.createElement('div');
      modelStatsLabel.textContent = '';
      modelCountFolderLi.appendChild(modelStatsLabel);
      this.modelStatsLabel = modelStatsLabel;
  
      modelCountFolder.__ul.appendChild( modelCountFolderLi );
      modelCountFolder.open();
    }
  
    updateEnvMap(url) {
      environments[1].path = url;
      this.updateEnvironment()
    }
  
    updateGUI () {
      this.cameraFolder.domElement.style.display = 'none';
  
      this.morphCtrls.forEach((ctrl) => ctrl.remove());
      this.morphCtrls.length = 0;
      this.morphFolder.domElement.style.display = 'none';
  
      this.animCtrls.forEach((ctrl) => ctrl.remove());
      this.animCtrls.length = 0;
      this.animFolder.domElement.style.display = 'none';
  
      const cameraNames = [];
      const morphMeshes = [];
      this.content.traverse((node) => {
        if (node.isMesh && node.morphTargetInfluences) {
          morphMeshes.push(node);
        }
        if (node.isCamera) {
          node.name = node.name || `VIEWER__camera_${cameraNames.length + 1}`;
          cameraNames.push(node.name);
        }
      });
  
      if (cameraNames.length) {
        this.cameraFolder.domElement.style.display = '';
        if (this.cameraCtrl) this.cameraCtrl.remove();
        const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
        this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
        this.cameraCtrl.onChange((name) => this.setCamera(name));
      }
  
      if (morphMeshes.length) {
        this.morphFolder.domElement.style.display = '';
        morphMeshes.forEach((mesh) => {
          if (mesh.morphTargetInfluences.length) {
            const nameCtrl = this.morphFolder.add({name: mesh.name || 'Untitled'}, 'name');
            this.morphCtrls.push(nameCtrl);
          }
          for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
            const ctrl = this.morphFolder.add(mesh.morphTargetInfluences, i, 0, 1, 0.01).listen();
            Object.keys(mesh.morphTargetDictionary).forEach((key) => {
              if (key && mesh.morphTargetDictionary[key] === i) ctrl.name(key);
            });
            this.morphCtrls.push(ctrl);
          }
        });
      }
  
      if (this.clips.length) {
        this.animFolder.domElement.style.display = '';
        const actionStates = this.state.actionStates = {};
        this.clips.forEach((clip, clipIndex) => {
          // Autoplay the first clip.
          let action;
          if (clipIndex === 0) {
            // actionStates[clip.name] = true;
            // action = this.mixer.clipAction(clip);
            // action.play();
  
            actionStates[clip.name] = false;
            action = this.mixer.clipAction(clip);
            action.clampWhenFinished = true;
            action.loop = LoopOnce;
            // action.play();
          } else {
            actionStates[clip.name] = false;
          }
  
          // Play other clips when enabled.
          const ctrl = this.animFolder.add(actionStates, clip.name).listen();
          ctrl.onChange((playAnimation) => {
            action = action || this.mixer.clipAction(clip);
            action.setEffectiveTimeScale(1);
            playAnimation ? action.play() : action.stop();
          });
          this.animCtrls.push(ctrl);
        });
      }
    }
  
    clear () {
  
      if ( !this.content ) return;
  
      this.scene.remove( this.content );
  
      // dispose geometry
      this.content.traverse((node) => {
  
        if ( !node.isMesh ) return;
  
        node.geometry.dispose();
  
      } );
  
      // dispose textures
      traverseMaterials( this.content, (material) => {
  
        MAP_NAMES.forEach( (map) => {
  
          if (material[ map ]) material[ map ].dispose();
  
        } );
  
      } );
  
    }
  
  };
  
  function traverseMaterials (object, callback) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach(callback);
    });
  }
  
  // https://stackoverflow.com/a/9039885/1314762
  function isIOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  }
  