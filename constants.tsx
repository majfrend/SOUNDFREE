
import { Track, User, Playlist } from './types';

export const INITIAL_TRACKS: Track[] = [
  {
    id: 't1',
    title: 'Neon Dreams',
    artist: 'SynthWaveMaster',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop',
    uploadDate: Date.now() - 1000 * 60 * 60 * 24,
    likesCount: 42,
    repostsCount: 12,
    duration: 240
  },
  {
    id: 't2',
    title: 'Deep Ocean Pulse',
    artist: 'AmbientFlow',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1459749411177-042180ce673f?q=80&w=1000&auto=format&fit=crop',
    uploadDate: Date.now() - 1000 * 60 * 60 * 5,
    likesCount: 156,
    repostsCount: 45,
    duration: 310
  },
  {
    id: 't3',
    title: 'Techno Revolution',
    artist: 'DjZero',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1514525253361-bee8a4874a73?q=80&w=1000&auto=format&fit=crop',
    uploadDate: Date.now() - 1000 * 60 * 30,
    likesCount: 89,
    repostsCount: 22,
    duration: 180
  },
  {
    id: 't4',
    title: 'Urban Silence',
    artist: 'LofiVibes',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop',
    uploadDate: Date.now() - 1000 * 60 * 10,
    likesCount: 204,
    repostsCount: 67,
    duration: 215
  },
  {
    id: 't5',
    title: 'Forgotten Forest',
    artist: 'NatureSonics',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop',
    uploadDate: Date.now() - 1000 * 60 * 2,
    likesCount: 33,
    repostsCount: 5,
    duration: 275
  }
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'p1',
    name: 'Midnight Beats',
    creator: 'mik',
    tracks: ['t1', 't3'],
    genres: ['techno', 'edm', 'hiphop'],
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'p2',
    name: 'Summer Vibes 2024',
    creator: 'Lucia',
    tracks: ['t2', 't4', 't5'],
    genres: ['pop', 'rap'],
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'p3',
    name: 'Deep Focus',
    creator: 'TheVibe',
    tracks: ['t4'],
    genres: ['lofi', 'ambient'],
    coverUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=400&auto=format&fit=crop'
  }
];

export const INITIAL_USERS: User[] = [
  {
    username: 'mik',
    bio: 'Producer from Milan. Love deep house.',
    profilePic: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop',
    likes: ['t1', 't4'],
    reposts: ['t1'],
    playlists: [],
    savedPlaylists: []
  }
];
