package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

type Actions string

const (
	ActionPlay     Actions = "PLAY"
	ActionPause    Actions = "PAUSE"
	ActionSeek     Actions = "SEEK"
	ActionNewTrack Actions = "NEW_TRACK"
)

var (
	clients   = make(map[*websocket.Conn]bool)
	broadcast = make(chan Message)
	// creates
	mutex = &sync.Mutex{}
)

type AudioInformation struct {
	Title    string  `json:"title"`
	Size     int64   `json:"size"`
	Duration float64 `json:"duration"`
}

type Message struct {
	Action  Actions          `json:"action"`
	Payload AudioInformation `json:"payload"`
}

type SongListMessage struct {
	Songs []string `json:"songs"`
}

// Upgrader changes an HTTP connection to a WebSocket connection
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Allow React (localhost:3000)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/ws", handleConnections)
	mux.HandleFunc("/get-audio", handleAudioDownload)
	wrappedMux := enableCORS(mux)

	// create a goroutine that will run in the background
	go handleMessages()

	fmt.Println("Server started on :8080")
	http.ListenAndServe(":8080", wrappedMux)
}

func getMusicList() ([]string, error) {
	files, err := os.ReadDir("./music")
	if err != nil {
		return nil, err
	}

	var songs []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".mp3") {
			songs = append(songs, file.Name())
		}
	}
	fmt.Println(songs)
	return songs, nil
}

func handleActionMessage(w http.ResponseWriter, r *http.Request) {
}

func handleAudioDownload(w http.ResponseWriter, r *http.Request) {
	songName := r.URL.Query().Get("title")
	if songName == "" {
		http.Error(w, "Missing song title", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join("./music", filepath.Base(songName))
	// filepath.base strips everything but the file name for security (to avoid stuff like ../../type_shi)

	http.ServeFile(w, r, filePath) // serve file looks at file extension and sets content-type accordingly
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil) // changes http connection to a websocket connection
	// conn: object that represents user's open pipe
	// can use this variable to communicate with client

	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()

	songList, _ := getMusicList()
	fmt.Println(songList)
	welcomeMsg := SongListMessage{
		Songs: songList,
	}

	conn.WriteJSON(welcomeMsg)

	for {
		var msg Message

		err := conn.ReadJSON(&msg)
		// blocks until read is available
		// uses Netpoller (epoll on Linux, kqueue on MacOS, iocp on Windows)

		if err != nil {
			fmt.Println("Vas: ", err)
			mutex.Lock()
			delete(clients, conn)
			mutex.Unlock()
			break
		}

		fmt.Println(msg)

		// send received message to the broadcast channel
		broadcast <- msg
	}
}

func handleMessages() {
	for {
		msg := <-broadcast

		mutex.Lock()
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				client.Close()
				delete(clients, client)
			}
		}
		mutex.Unlock()
	}
}
