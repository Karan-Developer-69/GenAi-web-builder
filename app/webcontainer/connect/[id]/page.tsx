"use client"
import { setupConnect } from '@webcontainer/api/connect';
import { useEffect } from 'react';

export default function page() {
  useEffect(()=>{
    setupConnect();
  },[])
  return <>
    Nothing....
  </>

}