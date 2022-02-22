import {useState,useEffect} from 'react';

export const Timmer=()=>{
    const [timmer,setTimmer]=useState(59);
    useEffect(()=>{
    setInterval(()=>{
      setTimmer(timmer-1);
    },1000);
    },[timmer])
    return (
        <div>
            <p>0:{timmer} s</p>
        </div>
    );
}
