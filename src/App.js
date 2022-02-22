import './App.css';
import {useState,useEffect,useCallback} from 'react';
function App() {
  const drone = new window.ScaleDrone('2xmbUiTsqTzukyf7');
  if (!window.location.hash) {
     window.location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
   }
  const data = window.location.hash.split("?");
  const roomHash = data[0].substring(1);
  console.log('roomHash is ',roomHash);
  const roomName = 'observable-' + roomHash;
  const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
  };
  const [room,setRoom]=useState(drone.subscribe(roomName));
  const [pc,setPc]=useState(new RTCPeerConnection(configuration));
  const [loading,setLoading]=useState(true);
  const [cameraText,setCameraText]=useState('');
  const [micText,setMicText]=useState('Mute');
  const [user,setUser]=useState(data[1].split("="));
  const [facingMode,setFacingMode]=useState(data[1].split("=")[0]==='student'?'user':'environment');
  const [deviceHeight,setDeviceHeight]=useState(window.innerHeight);
  const [remoteStream,setRemoteStream]=useState(null);
 const onSuccess=(sucess)=>{
    console.log(sucess);
  };
  const onError=(error)=> {
  console.log(error);
  };
useEffect(()=>{
  drone.on('open', error => {
    if (error) {
      return console.error(error);
    }
    room.on('open', error => {
      if (error) {
        onError(error);
      }
    });
    // We're connected to the room and received an array of 'members'
    // connected to the room (including us). Signaling server is ready.
    room.on('members', members => {
      // If we are the second user to connect to the room we will be creating the offer
      const isOfferer = members.length >= 4;
      startWebRTC(isOfferer);
    });
  });
},[]);
const [cameraStatus,setCameraStatus] = useState(false);
const [teacherInfo,setTeacherInfo] = useState(null);
const [isStudentCutTheCall,setStudentCutTheCall]=useState(false);
const [showCommentPage,setShowCommentPage]=useState(false);
useEffect(()=>{
  drone.on('open', error => {
    drone.publish({
      room: 'notifications',
      message:user[0]==='student'?{userType:user[0]}:{userType:user[0],name:user[1],profileImage:user[2]}
    });
  });
  if(user[0] === 'student'){
    drone.on('open', error => {
      const room = drone.subscribe('notifications');
      room.on('data', message => {
        console.log('Received message', message);
        setTeacherInfo(message);
        pc.onaddstream = event => {
          setStopTimmer(true);
          console.log('Remote stream had been arrived',event);
          setRemoteStream(event.stream);
          window.remoteVideo.srcObject = event.stream;
        };
      });
    });
  }
},[cameraText,user,cameraStatus,pc])
useEffect(()=>{
  if( window.ReactNativeWebView){
    window.ReactNativeWebView.postMessage("This is a message from javascript!");
  }
},[]);
useEffect(()=>{
  drone.on('open', error => {
    drone.publish({
      room: 'cut_call',
      message:{isStudentCutTheCall}
    });
  });
  drone.on('open', error => {
    const room = drone.subscribe('cut_call');
    room.on('data', message => {
      console.log('Received message', message);
      if( message.isStudentCutTheCall){
        setShowCommentPage(true);
      }
    });
  });
},[isStudentCutTheCall,setStudentCutTheCall])
 // Send signaling data via Scaledrone
const sendMessage=(message)=> {
  drone.publish({
    room: roomName,
    message
  });
}
const  startWebRTC=useCallback((isOfferer)=> {
  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  const switchCamera = window.localStorage.getItem('cameraSwitch');
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };
  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }
  // When a remote stream arrives display it in the #remoteVideo element
  if(user[0]==='teacher'){
    pc.onaddstream = event => {
      setStopTimmer(true);
      console.log('Remote stream had been arrived',event);
      setRemoteStream(event.stream);
      window.remoteVideo.srcObject = event.stream;
    };
  }
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode // 'user'Or 'environment'
  },
  }).then(stream => {
    setLoading(false);
    // Display your local video in #localVideo element
    window.localVideo.srcObject = stream;
    if(switchCamera === "0"){
      toggleVideo();
    }else{
      window.localStorage.setItem('cameraSwitch', 0);
      setCameraText("Hide cam");
      if(window.localStorage.getItem('muted')){
        if(window.localStorage.getItem('muted')==="1"){
          toggleAudio();
        }
      }
    }
    pc.addStream(stream);
  }, onError);
  // Listen to signaling data from Scaledrone
  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }
    if (message.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
},[]);

const toggleVideo= ()=> {
  const stream = window.localVideo.srcObject;
  const videoTrack = stream.getTracks().find(track => track.kind === 'video');
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    setCameraStatus(false);
    setCameraText('Show cam');
 } else {
    videoTrack.enabled = true;
    setCameraStatus(true);
    setCameraText("Hide cam");
 }
}
const toggleAudio= ()=> {
  const stream = window.localVideo.srcObject;
  const audioTrack = stream.getTracks().find(track => track.kind === 'audio');
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    localStorage.setItem('muted', 1);
    setMicText('unMute');
 } else {
    audioTrack.enabled = true;
    setMicText('Mute');
    localStorage.setItem('muted', 0);
 }
}
const localDescCreated=(desc)=> {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

const [counter, setCounter] = useState(65);
  const [stopTimmer, setStopTimmer] = useState(false);
  useEffect(() => {
    if (!stopTimmer) {
      let timmer =
        counter > 0 && setInterval(() => setCounter(counter - 1), 1000);
      return () => clearInterval(timmer);
    }
  }, [counter, stopTimmer]);
if(loading){
  return (
    <div className="spinnerContainer">
      <div className="spinner-4"></div>
    </div>
  )
}
if(user[0] === 'teacher' && showCommentPage){
  pc.close();
  return <div>
   <p style={{color:'black',textAlign:'center'}}>Give your feedback to Student </p>
  </div>
}
if(user[0] === 'student' && showCommentPage){
  return <div>
    <p style={{color:'black',textAlign:'center'}}>Give your feedback to Teacher </p>
  </div>
}
  return (
    <div className="container">
      {
        user[0]==='student' && ( <video style={{width:0,height:0,backgroundColor:'#000'}} id="localVideo" autoPlay={true} muted={true} ></video>) 
      }
     
      {
        user[0]==='teacher' && ( <div className="questionContainer">
        <img className="questionImage" src={`https://radiancejee.com/speaking_book/uploads/doubt_question/${roomHash}.png`} alt="question" />
        </div>)
      }
      {
        user[0] === 'student'&& remoteStream===null && (<div>
          <p className="msgContainer" style={{marginTop:deviceHeight/2-80}}>Searching Teacher for you   0:{counter} s</p>
        </div> )
      }
    {
      user[0] === 'student'&& remoteStream!==null && ( 
        <div>
          {!teacherInfo && <p>You are connected with teacher </p>}
          {
            teacherInfo && teacherInfo.userType==="teacher" &&(<div className="msg">
              <img style={{width:'50px',height:'50px',borderRadius:'50px',margin:'5px'}} src={`${teacherInfo.profileImage}?width=225&format=png&auto=webp&s=84379f8d3bbe593a2e863c438cd03e84c8a474fa`} alt="profile" />
             <p style={{marginRight:'10px'}}>{teacherInfo.name.split('%20')[0]} {teacherInfo.name.split('%20')[1]}</p>
            </div>)
          }
        </div>
      )
    }
      <div style={{
        width:'100vw',
        height:`${user[0]==='teacher'?200:deviceHeight}px`,
      }}>
         <video poster="https://joebirch.co/wp-content/uploads/2021/05/Screenshot_20210527_061703-485x1024.png" style={{
           width:'100vw',
           height:'100%',
           backgroundColor:'#000',
           objectFit: 'cover',
         }} id="remoteVideo" autoPlay={true} ></video>
      </div>
      {
        user[0]==='teacher' && (<video  
          poster="https://joebirch.co/wp-content/uploads/2021/05/Screenshot_20210527_061703-485x1024.png" 
          style={{width:'100%', height:`${deviceHeight-400}px`,backgroundColor:'#000',display:'block', objectFit: 'cover',}} id="localVideo" autoPlay={true} muted={true} ></video>) 
      }
      <div style={{width:'100%'}} className="videoption">
        <div style={{display:'flex',justifyContent: 'center' }}>
          {
             cameraText==="Show cam"?
             (<img  className="iconStyle" src="./assets/Video off.png" alt="Camera" onClick={toggleVideo}/>):
             (<img className="iconStyle" src="./assets/Video on.png" alt="Camera" onClick={toggleVideo}/>)
           }
           {
             micText==="unMute"?(<img className="iconStyle" src="./assets/mute microphone.png" alt="Camera" onClick={toggleAudio}/>):
             (<img className="iconStyle" src="./assets/on microphone.png" alt="Camera" onClick={toggleAudio}/>)
           }
          <img className="iconStyle" src="./assets/call disconet.png" alt="cut" onClick={()=> {
            console.log('closing connections')
            const stream = window.localVideo.srcObject;
            const videoTrack = stream.getTracks().find(track => track.kind === 'video');
            if (videoTrack.enabled) {
              videoTrack.enabled = false;
              setCameraStatus(false);
              setCameraText('Show cam');
           }
           const audioTrack = stream.getTracks().find(track => track.kind === 'audio');
          if (audioTrack.enabled) {
            audioTrack.enabled = false;
            localStorage.setItem('muted', 1);
            setMicText('unMute');
          }
            setStudentCutTheCall(true);
            setShowCommentPage(true);
          }} />
        </div>      
      </div>
    </div>
  );
}

export default App;
//  https://speakingbookconnect.herokuapp.com/#e9da98c57d4d10fc678d044f625f6dd7?student
// https://speakingbookconnect.herokuapp.com/#e9da98c57d4d10fc678d044f625f6dd7?teacher=vivek%20rai=https://preview.redd.it/h5gnz1ji36o61.png?width=225&format=png&auto=webp&s=84379f8d3bbe593a2e863c438cd03e84c8a474fa
// https://speakingbookconnect.herokuapp.com/#e9da98c57d4d10fc678d044f625f6dd7?student=Abhishek%20Singh=https://preview.redd.it/h5gnz1ji36o61.png?width=225&format=png&auto=webp&s=84379f8d3bbe593a2e863c438cd03e84c8a474fa

// http://localhost:3000/#e9da98c57d4d10fc678d044f625f6dd7?teacher=vivek%20rai=https://preview.redd.it/h5gnz1ji36o61.png?width=225&format=png&auto=webp&s=84379f8d3bbe593a2e863c438cd03e84c8a474fa
// http://localhost:3000/#e9da98c57d4d10fc678d044f625f6dd7?student=Abhishek%20Singh=https://preview.redd.it/h5gnz1ji36o61.png?width=225&format=png&auto=webp&s=84379f8d3bbe593a2e863c438cd03e84c8a474fa
// <iframe src="https://giphy.com/embed/tfUW8mhiFk8NlJhgEh" width="480" height="480" frameBorder="0" class="giphy-embed" allowFullScreen></iframe><p><a href="https://giphy.com/gifs/britishbakeoff-shock-shocking-liam-charles-tfUW8mhiFk8NlJhgEh">via GIPHY</a></p>