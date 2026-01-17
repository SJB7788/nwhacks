package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Upgrader changes an HTTP connection to a WebSocket connection
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Allow React (localhost:3000)
}

var (
	clients   = make(map[*websocket.Conn]bool)
	broadcast = make(chan Message)
	// creates
	mutex = &sync.Mutex{}
)

type Message struct {
	Action    string  `json:"action"`    // "PLAY", "PAUSE", "SEEK"
	Timestamp float64 `json:"timestamp"` // The sync time or song offset
}

func main() {
	http.HandleFunc("/ws", handleConnections)

	// create a goroutine that will run in the background
	go handleMessages()

	fmt.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
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

	for {
		var msg Message

		err := conn.ReadJSON(&msg)
		// blocks until read is available
		// uses Netpoller (epoll on Linux, kqueue on MacOS, iocp on Windows)

		if err != nil {
			mutex.Lock()
			delete(clients, conn)
			mutex.Unlock()
			break
		}

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
