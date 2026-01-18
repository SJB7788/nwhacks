import { act, useEffect, useState } from "react";
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

interface SongListMessage {
  songs: string[];
}

interface SongRequest {
  title: string;
}

export default function Home() {
  const { socket, audio, isReady } = useOutletContext<ContextType>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [library, setLibrary] = useState<string[]>([]);

  useEffect(() => {
    if (!isReady) return;

    socket.addEventListener("message", (event) => {
      try {
        const response: SongListMessage = JSON.parse(event.data);
        setLibrary(response.songs);
        console.log(response);
      } catch (err) {
        console.error("Failed to parse socket message", err);
      }
    });
  }, [isReady]);

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

  const onAudioPlay = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.name) {
      console.error("Failed to get song name");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8080/get-audio?title=${event.currentTarget.name}`,
        {
          method: "GET",
        },
      );

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audio.decodeAudioData(arrayBuffer);

      const audioSource = audio.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(audio.destination);
      audioSource.start();
      await audio.resume();
    } catch (err) {
      console.error("Failed to play song", err);
    }
  };

  return (
    <div className="home-root">
      <ul>
        {library.map((song) => (
          <li key={song}>
            {song}{" "}
            <button name={song} onClick={onAudioPlay}>
              Play
            </button>
          </li>
        ))}
      </ul>
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
