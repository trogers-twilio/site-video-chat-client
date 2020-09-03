import React, { Component } from "react";
import Video from "twilio-video";
import { Container, Row, Col, Button, Input } from "reactstrap";

/**
 * Replace with your twilio runtime domain
 */
const twilioRuntimeDomain = "ENTER_YOUR_DOMAIN.twil.io";

export default class VideoComp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      worker: "",
      token: "",
      identity: "",
      roomName: "" /* Will store the room name */,
      roomNameErr: false /* Track error for room name TextField. This will    enable us to show an error message when this variable is true */,
      previewTracks: null,
      localMediaAvailable: false /* Represents the availability of a LocalAudioTrack(microphone) and a LocalVideoTrack(camera) */,
      hasJoinedRoom: false,
      activeRoom: null, // Track the current active room
      screenTrack: null
    };

    this.joinRoom = this.joinRoom.bind(this);
    this.handleRoomNameChange = this.handleRoomNameChange.bind(this);
    this.roomJoined = this.roomJoined.bind(this);
    this.onPreviewVideo = this.onPreviewVideo.bind(this);
    this.onPreviewStop = this.onPreviewStop.bind(this);
    this.onLeaveRoom = this.onLeaveRoom.bind(this);
    this.onShareScreen = this.onShareScreen.bind(this);
    this.onStopShareScreen = this.onStopShareScreen.bind(this);
    this.detachParticipantTracks = this.detachParticipantTracks.bind(this);
  }

  handleRoomNameChange(e) {
    /* Fetch room name from text field and update state */
    let identity = e.target.value;
    this.setState({ identity });
  }

  joinRoom() {
    /*
   Show an error message on room name text field if user tries         joining a room without providing a room name. This is enabled by setting `roomNameErr` to true
     */
    // if (!this.state.roomName.trim()) {
    //   this.setState({ roomNameErr: true });
    //   return;
    // }

    console.log("Joining room '" + this.state.roomName + "'...");
    let connectOptions = {
      name: this.state.roomName
    };

    if (this.state.previewTracks) {
      connectOptions.tracks = this.state.previewTracks;
    }
    Video.connect(this.state.token, connectOptions).then(
      this.roomJoined,
      (error) => {
        alert("Could not connect to Twilio: " + error.message);
      }
    );
  }

  // Screen sharing
  getScreenShare() {
    if (navigator.getDisplayMedia) {
      return navigator.getDisplayMedia({ video: true });
    } else if (navigator.mediaDevices.getDisplayMedia) {
      return navigator.mediaDevices.getDisplayMedia({ video: true });
    } else {
      return navigator.mediaDevices.getUserMedia({
        video: { mediaSource: "screen" }
      });
    }
  }

  // Attach the Tracks to the DOM.
  attachTracks(tracks, container) {
    tracks.forEach((track) => {
      container.appendChild(track.attach());
    });
  }

  // Attach the Participant's Tracks to the DOM.
  attachParticipantTracks(participant, container) {
    var tracks = Array.from(participant.tracks.values());
    this.attachTracks(tracks, container);
  }

  // Detach the Tracks from the DOM.
  detachTracks(tracks) {
    tracks.forEach(function (track) {
      track.detach().forEach(function (detachedElement) {
        detachedElement.remove();
      });
    });
  }

  // Detach the Participant's Tracks from the DOM.
  detachParticipantTracks(participant) {
    var tracks = Array.from(participant.tracks.values());
    var previewContainer = this.refs.localMedia;
    if (!previewContainer.querySelector("video")) {
      this.detachParticipantTracks({ tracks: tracks }, previewContainer);
    }
  }

  onPreviewVideo() {
    var localTracksPromise = this.state.previewTracks
      ? Promise.resolve(this.state.previewTracks)
      : Video.createLocalTracks();

    localTracksPromise.then(
      (tracks) => {
        this.setState({
          previewTracks: tracks
        });

        var previewContainer = this.refs.localMedia;
        if (!previewContainer.querySelector("video")) {
          this.attachParticipantTracks({ tracks: tracks }, previewContainer);
        }
      },
      function (error) {
        console.error("Unable to access local media", error);
      }
    );
  }

  onPreviewStop() {
    this.detachTracks(this.state.previewTracks);

    this.setState({
      previewTracks: null
    });
  }

  onShareScreen() {
    this.getScreenShare().then((stream) => {
      this.setState({
        screenTrack: stream.getVideoTracks()[0]
      });
      this.state.activeRoom.localParticipant.publishTrack(
        stream.getVideoTracks()[0]
      );
      // document.getElementById("share-screen").style.display = 'none';
      // document.getElementById("stop-share-screen").style.display = 'inline';
    });
  }

  onStopShareScreen() {
    this.state.activeRoom.localParticipant.unpublishTrack(
      this.state.screenTrack
    );
    this.setState({
      screenTrack: null
    });
  }

  onCreateTask(roomName, customerName, worker, number) {
    fetch(
      `https://${twilioRuntimeDomain}/createvideotask?worker=${encodeURIComponent(
        worker
      )}&customerName=${customerName}&roomName=${roomName}&phoneNumber=${number}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("task data", data);
      });
  }

  roomJoined(room) {
    // Called when a participant joins a room
    console.log("Joined as '" + this.state.identity + "'");
    this.setState({
      activeRoom: room,
      localMediaAvailable: true,
      hasJoinedRoom: true // Removes ‘Join Room’ button and shows ‘Leave Room’
    });

    this.onCreateTask(
      this.state.roomName,
      this.state.roomName,
      localStorage.worker,
      localStorage.number
    );

    // Attach LocalParticipant's tracks to the DOM, if not already attached.
    var previewContainer = this.refs.localMedia;
    if (!previewContainer.querySelector("video")) {
      this.attachParticipantTracks(room.localParticipant, previewContainer);
    }

    if (!previewContainer.querySelector("video")) {
      this.attachParticipantTracks(room.localParticipant, previewContainer);
    }

    // Attach the Tracks of the room's participants.
    room.participants.forEach((participant) => {
      console.log("Already in Room: '" + participant.identity + "'");
      var previewContainer = this.refs.remoteMedia;
      this.attachParticipantTracks(participant, previewContainer);
    });

    // Participant joining room
    room.on("participantConnected", (participant) => {
      console.log("Joining: '" + participant.identity + "'");
    });

    // Attach participant’s tracks to DOM when they add a track
    room.on("trackSubscribed", (track, participant) => {
      console.log(participant.identity + " added track: " + track.kind);
      var previewContainer = this.refs.remoteMedia;
      this.attachTracks([track], previewContainer);
    });

    // Detach participant’s track from DOM when they remove a track.
    room.on("trackUnsubscribed", (track, participant) => {
      console.log(participant.identity + " removed track: " + track.kind);
      this.detachTracks([track]);
    });

    // Detach all participant’s track when they leave a room.
    room.on("participantDisconnected", (participant) => {
      console.log("Participant '" + participant.identity + "' left the room");
      this.detachParticipantTracks(participant);
    });

    // Once the local participant leaves the room, detach the Tracks
    // of all other participants, including that of the LocalParticipant.
    room.on("disconnected", () => {
      if (this.state.previewTracks) {
        this.state.previewTracks.forEach((track) => {
          track.stop();
        });
      }
      this.detachParticipantTracks(room.localParticipant);
      room.participants.forEach(this.detachParticipantTracks);
      this.setState({
        activeRoom: null,
        hasJoinedRoom: false,
        previewTracks: null,
        localMediaAvailable: false
      });
    });
  }

  onLeaveRoom() {
    this.state.activeRoom.disconnect();
  }

  componentDidMount() {
    fetch(
      `https://${twilioRuntimeDomain}/flexvideotokenizer?Identity=${this.state.identity}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("data:", data);
        this.setState({
          token: data.token,
          identity: data.identity,
          roomName: Date.now()
        });
      });
  }

  render() {
    // Hide 'Join Room' button if user has already joined a room.
    let joinOrLeaveRoomButton = this.state.hasJoinedRoom ? (
      <Button color="danger" onClick={this.onLeaveRoom}>
        Hang Up
      </Button>
    ) : (
      <div>
        <Button color="success" onClick={this.joinRoom}>
          Start Video
        </Button>
      </div>
    );

    let shareScreenButton;

    if (this.state.hasJoinedRoom && !this.state.screenTrack) {
      shareScreenButton = (
        <Button color="success" onClick={this.onShareScreen}>
          Share Screen
        </Button>
      );
    } else if (this.state.hasJoinedRoom && this.state.screenTrack) {
      shareScreenButton = (
        <Button color="danger" onClick={this.onStopShareScreen}>
          Stop Sharing
        </Button>
      );
    } else {
      shareScreenButton = null;
    }

    let previewVideo;

    if (this.state.previewTracks && !this.state.hasJoinedRoom) {
      previewVideo = <Button onClick={this.onPreviewStop}>Stop Preview</Button>;
    } else if (this.state.hasJoinedRoom) {
      previewVideo = null;
    } else {
      previewVideo = (
        <Button onClick={this.onPreviewVideo}>Preview Video</Button>
      );
    }

    return (
      <div>
        <Row style={{ marginTop: 10 }}>
          <Col md="12">
            <div
              className="remoteContainer"
              ref="remoteMedia"
              id="remote-media"
            />
          </Col>
        </Row>
        <Row>
          <Col md="6" className="text-center">
            <div className="preview">
              <div ref="localMedia" />
            </div>
            {previewVideo}
          </Col>
        </Row>
        <Container>
          <Row>
            <Col md="4">
              <br />
              {!this.state.hasJoinedRoom ? (
                <Input
                  value={this.state.identity ? this.state.identity : ""}
                  placeholder="Customer Name"
                  onChange={this.handleRoomNameChange}
                />
              ) : null}
              <br />
              <Row>
                {joinOrLeaveRoomButton}
                <span>&nbsp;</span>
                {shareScreenButton}
              </Row>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}
