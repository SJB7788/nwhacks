Local music sharing application

Want to be able to upload local music and share with other people
- A unique link used to share different albums

Synchronized listening
- create a listening link and sync up to listen together

Sync logic
- 3-5 second initial sync 

Initial play:
- behind the scenes, maybe get timestamp when host decides to play song 
- add couple seconds to that time as music start time
- host + clients will music play at the same time 
- if clients fail to play right away or receives the timemstamp late, then skip part of the song to match the time (curr time - start time)

If host seeks:
- same idea but removing the sync time
- record start time and send it to clients and calculation if curr time - start time to sync
