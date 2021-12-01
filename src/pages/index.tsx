import styles from './index.less';
// @ts-ignore
import {Viewer} from './views/ModelView3';

export default function IndexPage() {
  return (
    <div>
      <h1 className={styles.title}>Page index</h1>
    </div>
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const viewerEl = document.createElement('div');
  document.body.appendChild(viewerEl);
  // viewerEl.classList.add('viewer');
  const viewer = new Viewer(viewerEl, {});
  viewer
  .load('assets/default.glb', 'assets/default.glb', new Map())
  .catch((e:any) => {})
  .then((gltf:any) => { 
  
  });
}); 
