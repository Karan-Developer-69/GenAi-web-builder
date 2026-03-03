"use client"
import { setupConnect } from '@webcontainer/api/connect';
import { useEffect } from 'react';

export default function Page() {
  useEffect(()=>{
    setupConnect();
  },[])
  return <>
    Nothing....
  </>

}