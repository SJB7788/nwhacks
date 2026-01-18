import { act, useState } from "react";
import { useOutletContext } from "react-router";

interface ContextType {
  socket: WebSocket;
  audio: AudioContext;
  isReady: boolean;
}

interface AudioInformation {
  title: string;
  size: number;
  duration: number;
}

enum Actions {
  PLAY = "PLAY",
  PAUSE = "PAUSE",
  SEEK = "SEEK",
  NEW_TRACK = "NEW_TRACK",
}

interface Message {
  action: Actions;
  payload: AudioInformation;
}

export default function Home() {
  const { socket, audio, isReady } = useOutletContext<ContextType>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const onAudioFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files || event.target.files.length < 0) {
      return;
    }

    setSelectedFile(event.target.files[0]); // useState state update is asynchronous.

    const file = event.target.files[0];
    const blob = await file?.arrayBuffer();

    if (!blob) {
      console.log("Error");
      setErrorMessage("Error extracting audio file");
      return;
    }

    const audioBuffer = await audio.decodeAudioData(blob);

    const audioInfo: AudioInformation = {
      title: file.name,
      size: file.size,
      duration: audioBuffer.duration,
    };

    const message: Message = {
      action: Actions.NEW_TRACK,
      payload: audioInfo,
    };

    const messageJson = JSON.stringify(message);
    socket.send(messageJson);

    console.log("Sent message to server");

    const audioSource = audio.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audio.destination);
    audioSource.start();
    await audio.resume();
  };

  return (
    <div className="home-root">
      <input
        type="file"
        accept=".mp3, .flac, .wav"
        onChange={onAudioFileInput}
        multiple
      />

      <button type="button">Play</button>
    </div>
  );
}
