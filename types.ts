
export interface User {
  username: string;
  password?: string;
  bio: string;
  profilePic: string;
  likes: string[]; // IDs of tracks
  reposts: string[]; // IDs of tracks
  playlists: Playlist[];
  savedPlaylists: string[]; // IDs of followed playlists
}

export interface Playlist {
  id: string;
  name: string;
  creator: string;
  tracks: string[]; // IDs of tracks
  genres: string[]; // Max 3 genres
  coverUrl: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
  uploadDate: number; // Timestamp
  likesCount: number;
  repostsCount: number;
  duration: number; // Seconds
}

export interface AppState {
  currentUser: User | null;
  tracks: Track[];
  registeredUsers: User[];
  playlists: Playlist[];
  isPlaying: boolean;
  currentTrack: Track | null;
  activeQueue: string[]; // IDs delle tracce in riproduzione
  queueIndex: number;
  isShuffle: boolean;
  loopMode: 'none' | 'all' | 'one';
  // Fair Rotation State
  featuredPool: string[]; // Usernames of artists yet to be featured in the current cycle
  feedOrder: string[]; // Ordered list of track IDs for the home feed
}
