/*
 * @Description:
 * @Author: 彭祥 (Email:px.i@foxmail.com QQ:245803627)
 * @Date: 2021-06-30 09:14
 * @LastEditors: PengXiang
 * @LastEditTime: 2021-06-30 09:14
 */
import React, {useEffect, useRef, useState,} from "react";
import styled from "./index.module.css";
import { Viewer } from "../ModelView3";

export const App = () => {

    useEffect(()=>{

        init();
        return ()=>{}
    }, []);

    const init = async () => {
     
        console.log('App');

    }



    return (
        <div style={{overflow:"hidden",}}>

        </div>

    )
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
  

