
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Heart, 
  Search, Home, Download, Plus, Music, User, Bookmark, MoreHorizontal, Share2, Check, Repeat, Lock, PlusSquare, X, Upload, Settings, Camera, FileAudio,
  ChevronDown, ChevronUp, Shuffle, Repeat1
} from 'lucide-react';
import { INITIAL_TRACKS, INITIAL_USERS, INITIAL_PLAYLISTS } from './constants';
import { User as UserType, Track, AppState, Playlist } from './types';
import { checkTrackOriginality } from './services/geminiService';

const ROTATION_INTERVAL = 120000;
const CHECK_INTERVAL = 5000;

const GENRES = [
  'pop', 'hiphop', 'trap', 'rap', 'r&b', 'd&b', 'house', 'techouse', 
  'futurehouse', 'classica', 'gospel', 'techno', 'minimal', 'psy', 
  'hardstyle', 'hardcore', 'basshouse', 'reagge', 'reggeton', 'latina', 
  'commercial', 'dance', 'trance', 'drill', 'uk', 'dubstep'
];

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === undefined) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const getInitialState = (): AppState => {
    const savedTracks = localStorage.getItem('soundfree_tracks');
    const savedUsers = localStorage.getItem('soundfree_users');
    const savedCurrent = localStorage.getItem('soundfree_session');
    const savedPlaylists = localStorage.getItem('soundfree_playlists');
    
    const users = savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS;
    const tracks = savedTracks ? JSON.parse(savedTracks) : INITIAL_TRACKS;

    return {
      tracks: tracks,
      registeredUsers: users,
      playlists: savedPlaylists ? JSON.parse(savedPlaylists) : INITIAL_PLAYLISTS,
      currentUser: savedCurrent ? JSON.parse(savedCurrent) : null,
      isPlaying: false,
      currentTrack: null,
      activeQueue: [],
      queueIndex: -1,
      isShuffle: false,
      loopMode: 'none',
      featuredPool: users.map((u: UserType) => u.username),
      feedOrder: tracks.map((t: Track) => t.id)
    };
  };

  const [state, setState] = useState<AppState>(getInitialState());
  const [view, setView] = useState<'home' | 'profile' | 'playlists' | 'auth' | 'search'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<Track | null>(null);

  // Salvataggio stato
  useEffect(() => {
    try {
      localStorage.setItem('soundfree_tracks', JSON.stringify(state.tracks));
      localStorage.setItem('soundfree_users', JSON.stringify(state.registeredUsers));
      localStorage.setItem('soundfree_session', JSON.stringify(state.currentUser));
      localStorage.setItem('soundfree_playlists', JSON.stringify(state.playlists));
    } catch (e) {
      console.warn("Storage Quota Exceeded.");
    }
  }, [state]);

  // Gestione audio robusta per evitare errori di interruzione play()
  const playAudio = async () => {
    if (audioRef.current && state.isPlaying) {
      try {
        await audioRef.current.play();
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn("Playback error handled:", err.message);
      }
    }
  };

  useEffect(() => {
    if (state.isPlaying && state.currentTrack) {
      playAudio();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [state.isPlaying, state.currentTrack?.id, state.currentTrack?.audioUrl]);

  const handlePlay = (track: Track, fromQueue?: string[]) => {
    // Se la traccia è la stessa, facciamo il toggle del play/pause
    if (state.currentTrack?.id === track.id) {
      setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
      return;
    }

    const queue = fromQueue || (view === 'home' ? state.feedOrder : [track.id]);
    const index = queue.indexOf(track.id);
    setState(prev => ({ 
      ...prev, 
      currentTrack: track, 
      isPlaying: true,
      activeQueue: queue,
      queueIndex: index !== -1 ? index : 0
    }));
    setCurrentTime(0);
  };

  const handleSkipForward = () => {
    setState(prev => {
      if (!prev.activeQueue.length) return { ...prev, isPlaying: false };
      if (prev.loopMode === 'one' && audioRef.current) {
        audioRef.current.currentTime = 0;
        return { ...prev, isPlaying: true };
      }

      let nextIndex;
      if (prev.isShuffle) {
        nextIndex = Math.floor(Math.random() * prev.activeQueue.length);
      } else {
        nextIndex = prev.queueIndex + 1;
      }

      if (nextIndex >= prev.activeQueue.length) {
        if (prev.loopMode === 'all') nextIndex = 0;
        else return { ...prev, isPlaying: false };
      }

      const nextTrack = prev.tracks.find(t => t.id === prev.activeQueue[nextIndex]);
      return { ...prev, queueIndex: nextIndex, currentTrack: nextTrack || null, isPlaying: !!nextTrack };
    });
    setCurrentTime(0);
  };

  const handleSkipBackward = () => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    setState(prev => {
      if (!prev.activeQueue.length) return prev;
      let prevIndex = prev.queueIndex - 1;
      if (prevIndex < 0) {
        if (prev.loopMode === 'all') prevIndex = prev.activeQueue.length - 1;
        else prevIndex = 0;
      }
      const prevTrack = prev.tracks.find(t => t.id === prev.activeQueue[prevIndex]);
      return { ...prev, queueIndex: prevIndex, currentTrack: prevTrack || null, isPlaying: !!prevTrack };
    });
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.currentTrack || !progressBarRef.current || !audioRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percentage * state.currentTrack.duration;
  };

  const handleLike = (trackId: string) => {
    if (!state.currentUser) return setView('auth');
    setState(prev => {
      const isLiked = prev.currentUser!.likes.includes(trackId);
      const newLikes = isLiked ? prev.currentUser!.likes.filter(id => id !== trackId) : [...prev.currentUser!.likes, trackId];
      const newTracks = prev.tracks.map(t => t.id === trackId ? { ...t, likesCount: t.likesCount + (isLiked ? -1 : 1) } : t);
      const updatedUser = { ...prev.currentUser!, likes: newLikes };
      return { ...prev, currentUser: updatedUser, tracks: newTracks, registeredUsers: prev.registeredUsers.map(u => u.username === updatedUser.username ? updatedUser : u) };
    });
  };

  const handleRepost = (trackId: string) => {
    if (!state.currentUser) return setView('auth');
    setState(prev => {
      const isReposted = prev.currentUser!.reposts.includes(trackId);
      const newReposts = isReposted ? prev.currentUser!.reposts.filter(id => id !== trackId) : [trackId, ...prev.currentUser!.reposts];
      const newTracks = prev.tracks.map(t => t.id === trackId ? { ...t, repostsCount: t.repostsCount + (isReposted ? -1 : 1) } : t);
      const updatedUser = { ...prev.currentUser!, reposts: newReposts };
      return { ...prev, currentUser: updatedUser, tracks: newTracks, registeredUsers: prev.registeredUsers.map(u => u.username === updatedUser.username ? updatedUser : u) };
    });
  };

  const handleSavePlaylist = (playlistId: string) => {
    if (!state.currentUser) return setView('auth');
    setState(prev => {
      const isSaved = prev.currentUser!.savedPlaylists.includes(playlistId);
      const newSaved = isSaved ? prev.currentUser!.savedPlaylists.filter(id => id !== playlistId) : [...prev.currentUser!.savedPlaylists, playlistId];
      const updatedUser = { ...prev.currentUser!, savedPlaylists: newSaved };
      return { ...prev, currentUser: updatedUser, registeredUsers: prev.registeredUsers.map(u => u.username === updatedUser.username ? updatedUser : u) };
    });
  };

  const handleDownload = (track: Track) => {
    const link = document.createElement('a');
    link.href = track.audioUrl;
    link.download = `${track.artist} - ${track.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (track: Track) => {
    const shareData = { title: 'Soundfree', text: `Ascolta "${track.title}" su Soundfree!`, url: `${window.location.origin}/track/${track.id}` };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { /* ignore */ }
    } else {
      navigator.clipboard.writeText(shareData.url).then(() => alert(`Link copiato!`));
    }
  };

  const toggleLoopMode = () => {
    setState(prev => {
      const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
      return { ...prev, loopMode: modes[(modes.indexOf(prev.loopMode) + 1) % modes.length] };
    });
  };

  const feedTracks = useMemo(() => state.feedOrder.map(id => state.tracks.find(t => t.id === id)).filter((t): t is Track => !!t), [state.feedOrder, state.tracks]);
  const searchResults = useMemo(() => !searchQuery ? [] : state.tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase())), [searchQuery, state.tracks]);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <audio ref={audioRef} src={state.currentTrack?.audioUrl} onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)} onEnded={handleSkipForward} />

      <nav className="w-16 lg:w-64 flex flex-col border-r border-zinc-800 p-3 lg:p-5 gap-2 relative">
        <h1 className="text-xl font-black mb-10 px-2 hidden lg:block text-orange-500 tracking-tighter italic">SOUNDFREE</h1>
        <div className="lg:hidden mb-10 flex justify-center"><Music className="text-orange-500 w-8 h-8" /></div>
        <NavBtn icon={<Home />} label="Home" active={view === 'home'} onClick={() => setView('home')} />
        <NavBtn icon={<Upload />} label="Carica" active={false} onClick={() => { if (!state.currentUser) return setView('auth'); setIsUploadModalOpen(true); }} className="bg-orange-600/10 hover:bg-orange-600/20 !text-orange-500 border border-orange-500/20" />
        <NavBtn icon={<Search />} label="Search" active={view === 'search'} onClick={() => setView('search')} />
        <NavBtn icon={<PlusSquare />} label="Playlists" active={view === 'playlists'} onClick={() => setView('playlists')} />
        {state.currentUser ? (
          <NavBtn icon={<img src={state.currentUser.profilePic} className="w-6 h-6 rounded-full border border-orange-500 object-cover" alt="me" />} label="Profilo" active={view === 'profile'} onClick={() => setView('profile')} />
        ) : (
          <NavBtn icon={<User />} label="Accedi" active={view === 'auth'} onClick={() => setView('auth')} />
        )}
        <div className="mt-auto space-y-2">
          {state.currentUser && (
            <>
              <NavBtn icon={<Settings className="w-6 h-6" />} label="Opzioni" active={false} onClick={() => setIsSettingsModalOpen(true)} />
              <NavBtn icon={<Lock />} label="Esci" active={false} onClick={() => { setState(p => ({ ...p, currentUser: null })); setView('home'); }} />
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto pt-8 pb-32 scrollbar-hide">
          <div className="max-w-[540px] mx-auto px-4 md:px-0">
            {view === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                {feedTracks.map((track) => (
                  <InstagramTrackPost 
                    key={track.id} track={track} onPlay={() => handlePlay(track)} isPlaying={state.isPlaying && state.currentTrack?.id === track.id}
                    onDownload={() => handleDownload(track)} onShare={() => handleShare(track)} onLike={() => handleLike(track.id)}
                    isLiked={state.currentUser?.likes.includes(track.id) || false} onRepost={() => handleRepost(track.id)}
                    isReposted={state.currentUser?.reposts.includes(track.id) || false} onAddToPlaylist={() => { if(!state.currentUser) return setView('auth'); setSelectedTrackForPlaylist(track); setIsPlaylistModalOpen(true); }}
                  />
                ))}
              </div>
            )}
            {view === 'search' && (
              <div className="space-y-8">
                <div className="px-2"><div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 group-focus-within:text-orange-500 transition-colors" /><input autoFocus type="text" placeholder="Cerca..." className="w-full bg-zinc-900 border border-zinc-800 p-4 pl-12 rounded-2xl outline-none focus:border-orange-500 transition-all font-bold" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
                <div className="space-y-4">{searchResults.map(track => (<TrackItem key={track.id} track={track} onPlay={() => handlePlay(track)} isPlaying={state.currentTrack?.id === track.id && state.isPlaying} onDownload={() => handleDownload(track)} onAddToPlaylist={() => { if(!state.currentUser) return setView('auth'); setSelectedTrackForPlaylist(track); setIsPlaylistModalOpen(true); }} onLike={() => handleLike(track.id)} isLiked={state.currentUser?.likes.includes(track.id)} />))}</div>
              </div>
            )}
            {view === 'playlists' && <PlaylistsView state={state} onPlayTrack={handlePlay} onCreateNew={() => { if(!state.currentUser) return setView('auth'); setSelectedTrackForPlaylist(null); setIsPlaylistModalOpen(true); }} onSavePlaylist={handleSavePlaylist} onDownloadTrack={handleDownload} />}
            {view === 'auth' && <AuthView state={state} setState={setState} setView={setView} />}
            {view === 'profile' && <ProfileView state={state} onPlay={handlePlay} isPlayingId={state.currentTrack?.id} isGlobalPlaying={state.isPlaying} onDownload={handleDownload} onAddToPlaylist={(t: Track) => { setSelectedTrackForPlaylist(t); setIsPlaylistModalOpen(true); }} onLike={handleLike} onRepost={handleRepost} onSavePlaylist={handleSavePlaylist} onUpdateProfilePic={(pic: string) => setState(p => ({ ...p, currentUser: p.currentUser ? {...p.currentUser, profilePic: pic} : null, registeredUsers: p.registeredUsers.map(u => u.username === p.currentUser?.username ? {...u, profilePic: pic} : u) }))} />}
          </div>
        </div>

        <aside className="hidden lg:flex w-72 flex-col border-l border-zinc-800 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-zinc-950 flex items-center justify-center border-r border-zinc-800 z-20"><span className="text-zinc-600 font-black text-2xl uppercase tracking-[0.5em] rotate-180 [writing-mode:vertical-lr]">PLAYLIST</span></div>
          <div className="pl-12 pr-6 pt-12 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-900"><h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Community Feed</h3><span className="text-[9px] text-orange-500 font-bold uppercase animate-pulse">Live</span></div>
            <div className="flex-1 relative overflow-hidden group">
              <div className="space-y-4 animate-vertical-scroll">
                {state.playlists.map((playlist, idx) => (
                  <PlaylistCardRight key={`${playlist.id}-${idx}`} playlist={playlist} onSave={() => handleSavePlaylist(playlist.id)} isSaved={state.currentUser?.savedPlaylists.includes(playlist.id)} onPlay={() => { if(playlist.tracks.length) handlePlay(state.tracks.find(t => t.id === playlist.tracks[0])!, playlist.tracks) }} />
                ))}
              </div>
              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
              <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
            </div>
          </div>
        </aside>
      </main>

      {state.currentTrack && (
        <footer className="fixed bottom-0 w-full h-24 bg-black/95 border-t border-zinc-800 px-4 md:px-8 flex flex-col md:flex-row items-center justify-between z-[100] backdrop-blur-xl">
          <div ref={progressBarRef} onClick={handleSeek} className="absolute top-0 left-0 w-full h-1.5 bg-zinc-900 cursor-pointer group">
            <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] relative transition-all duration-100" style={{ width: `${(currentTime / (state.currentTrack.duration || 1)) * 100}%` }}><div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg"></div></div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-1/3 mt-2 md:mt-0"><img src={state.currentTrack.coverUrl} className="w-12 h-12 rounded shadow-lg object-cover" alt="" /><div className="truncate"><h4 className="font-bold text-sm truncate">{state.currentTrack.title}</h4><p className="text-[10px] text-zinc-500 truncate font-black uppercase">@{state.currentTrack.artist}</p></div></div>
          <div className="flex flex-col items-center w-full md:w-1/3 gap-1 mt-1 md:mt-0">
            <div className="flex items-center gap-6">
              <button onClick={() => setState(p => ({...p, isShuffle: !p.isShuffle}))} className={`transition-colors ${state.isShuffle ? 'text-orange-500' : 'text-zinc-600 hover:text-white'}`}><Shuffle className="w-4 h-4" /></button>
              <button onClick={handleSkipBackward} className="text-zinc-500 hover:text-white transition-colors"><SkipBack className="w-5 h-5 fill-current" /></button>
              <button onClick={() => setState(p => ({ ...p, isPlaying: !p.isPlaying }))} className="bg-white text-black p-2 rounded-full hover:scale-110 transition-transform shadow-lg">{state.isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}</button>
              <button onClick={handleSkipForward} className="text-zinc-500 hover:text-white transition-colors"><SkipForward className="w-5 h-5 fill-current" /></button>
              <button onClick={toggleLoopMode} className={`transition-colors flex items-center gap-0.5 ${state.loopMode !== 'none' ? 'text-orange-500' : 'text-zinc-600 hover:text-white'}`}>
                {state.loopMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                {state.loopMode === 'all' && <span className="text-[8px] font-black">ALL</span>}
              </button>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-mono w-48"><span>{formatTime(currentTime)}</span><div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-zinc-700" style={{ width: `${(currentTime / (state.currentTrack.duration || 1)) * 100}%` }}></div></div><span>{formatTime(state.currentTrack.duration)}</span></div>
          </div>
          <div className="hidden md:flex items-center justify-end w-1/3 gap-6">
             <Download onClick={() => handleDownload(state.currentTrack!)} className="w-5 h-5 text-zinc-500 hover:text-white cursor-pointer transition-colors" />
             <Share2 onClick={() => handleShare(state.currentTrack!)} className="w-5 h-5 text-zinc-500 hover:text-white cursor-pointer transition-colors" />
          </div>
        </footer>
      )}

      {isPlaylistModalOpen && <PlaylistModal track={selectedTrackForPlaylist} state={state} setState={setState} onClose={() => setIsPlaylistModalOpen(false)} />}
      {isUploadModalOpen && <UploadModal state={state} setState={setState} onClose={() => setIsUploadModalOpen(false)} />}
      {isSettingsModalOpen && state.currentUser && <SettingsModal user={state.currentUser} state={state} setState={setState} onClose={() => setIsSettingsModalOpen(false)} />}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } @keyframes vertical-scroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } } .animate-vertical-scroll { animation: vertical-scroll 40s linear infinite; } .animate-vertical-scroll:hover { animation-play-state: paused; }`}</style>
    </div>
  );
};

const NavBtn = ({ icon, label, active, onClick, className = "" }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full p-3 rounded-xl hover:bg-zinc-900 transition-all ${active ? 'font-black text-white' : 'text-zinc-500'} ${className}`}><div className={`transition-all duration-300 ${active ? 'scale-110 text-orange-500' : ''}`}>{icon}</div><span className="hidden lg:block text-xs font-black uppercase tracking-widest">{label}</span></button>
);

const UploadModal = ({ state, setState, onClose }: any) => {
  const [title, setTitle] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [coverDataUrl, setCoverDataUrl] = useState('');
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setAudioDataUrl(dataUrl);
        const audio = new Audio(dataUrl);
        audio.onloadedmetadata = () => { setAudioDuration(audio.duration); setIsUploading(false); };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!title || !state.currentUser || !audioDataUrl) return alert("Dati mancanti!");
    setIsUploading(true);
    try {
      const check = await checkTrackOriginality(title, state.currentUser.username);
      if (!check.isOriginal && !window.confirm(`Sospetto copyright: ${check.reason}. Vuoi procedere?`)) {
        setIsUploading(false); return;
      }
      const newTrack: Track = { 
        id: `t_${Date.now()}`, 
        title, 
        artist: state.currentUser.username, 
        audioUrl: audioDataUrl, 
        coverUrl: coverDataUrl || `https://picsum.photos/seed/${title}/500/500`, 
        uploadDate: Date.now(), 
        likesCount: 0, 
        repostsCount: 0, 
        duration: Math.floor(audioDuration) || 180 
      };
      setState((prev: AppState) => ({ ...prev, tracks: [newTrack, ...prev.tracks], feedOrder: [newTrack.id, ...prev.feedOrder] }));
      onClose();
    } finally { setIsUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] p-8 relative shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-hide">
        <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X /></button>
        <h3 className="text-xl font-black mb-6 uppercase tracking-tighter">Carica la tua musica</h3>
        <div className="space-y-6">
          <input type="text" placeholder="Titolo" className="w-full bg-black/40 p-4 rounded-2xl outline-none font-bold" value={title} onChange={e => setTitle(e.target.value)} />
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500">Genere (Scegline 1)</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-black/20 rounded-2xl scrollbar-hide">
              {GENRES.map(g => (
                <button 
                  key={g} 
                  onClick={() => setSelectedGenre(g === selectedGenre ? '' : g)} 
                  className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${selectedGenre === g ? 'bg-orange-500 border-orange-500 text-black' : 'border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500">Copertina</label>
              <div onClick={() => coverInputRef.current?.click()} className="w-full aspect-square bg-black/40 rounded-2xl border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer">
                {coverDataUrl ? <img src={coverDataUrl} className="w-full h-full object-cover" alt="" /> : <Camera className="text-zinc-500" />}
              </div>
              <input type="file" hidden ref={coverInputRef} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setCoverDataUrl(r.result as string); r.readAsDataURL(f); } }} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500">Audio</label>
              <div onClick={() => audioInputRef.current?.click()} className="w-full aspect-square bg-black/40 rounded-2xl border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer">
                {audioDataUrl ? <FileAudio className="text-orange-500 w-10 h-10" /> : <Music className="text-zinc-500" />}
                {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>}
              </div>
              <input type="file" hidden ref={audioInputRef} accept="audio/*" onChange={handleAudioChange} />
            </div>
          </div>
          <button onClick={handleUpload} disabled={isUploading} className="w-full bg-orange-600 text-white font-black p-4 rounded-2xl uppercase hover:bg-orange-500 transition-all flex items-center justify-center gap-2">
            {isUploading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verificando...</> : "Pubblica"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileView = ({ state, onPlay, isPlayingId, isGlobalPlaying, onDownload, onAddToPlaylist, onLike, onRepost, onSavePlaylist, onUpdateProfilePic }: any) => {
  if (!state.currentUser) return null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myRepostedTracks = state.tracks.filter((t: Track) => state.currentUser?.reposts.includes(t.id));
  const myOwnTracks = state.tracks.filter((t: Track) => t.artist === state.currentUser?.username).sort((a: Track, b: Track) => b.uploadDate - a.uploadDate);
  const mySavedPlaylists = state.playlists.filter((p: Playlist) => state.currentUser?.savedPlaylists.includes(p.id));

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col items-center gap-6 mb-12 border-b border-zinc-900 pb-12">
        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-orange-500 to-red-600 shadow-2xl relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <img src={state.currentUser.profilePic} className="w-full h-full rounded-full border-4 border-black object-cover" alt="" /><div className="absolute inset-1 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white w-8 h-8" /></div>
          <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => onUpdateProfilePic(r.result as string); r.readAsDataURL(f); } }} />
        </div>
        <div className="text-center"><h2 className="text-3xl font-black uppercase tracking-tighter">@{state.currentUser.username}</h2><p className="text-zinc-500 italic mt-2 text-sm max-w-xs mx-auto">"{state.currentUser.bio}"</p></div>
      </div>
      <div className="space-y-12 pb-10">
        <section><h3 className="text-xs font-black uppercase text-zinc-600 mb-6 px-2 tracking-[0.3em]">Timeline</h3><div className="space-y-4">
          {myRepostedTracks.map((t: Track) => (<TrackItem key={`repost-${t.id}`} track={t} isRepost onPlay={() => onPlay(t)} isPlaying={isPlayingId === t.id && isGlobalPlaying} onDownload={() => onDownload(t)} onAddToPlaylist={() => onAddToPlaylist(t)} onLike={() => onLike(t.id)} isLiked={state.currentUser?.likes.includes(t.id)} />))}
          {myOwnTracks.map((t: Track) => (<TrackItem key={t.id} track={t} onPlay={() => onPlay(t)} isPlaying={isPlayingId === t.id && isGlobalPlaying} onDownload={() => onDownload(t)} onAddToPlaylist={() => onAddToPlaylist(t)} onLike={() => onLike(t.id)} isLiked={state.currentUser?.likes.includes(t.id)} />))}
        </div></section>
        {mySavedPlaylists.length > 0 && (
          <section><h3 className="text-xs font-black uppercase text-zinc-600 mb-6 px-2 tracking-[0.3em]">Playlist Preferite</h3><div className="space-y-4">
            {mySavedPlaylists.map((p: Playlist) => (<div key={p.id} className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-2xl hover:bg-zinc-800 transition-all cursor-pointer" onClick={() => { if(p.tracks.length) onPlay(state.tracks.find((t:Track) => t.id === p.tracks[0])!, p.tracks) }}><img src={p.coverUrl} className="w-12 h-12 rounded-lg object-cover" alt="" /><div className="flex-1"><p className="font-black text-sm uppercase">{p.name}</p><p className="text-[10px] text-zinc-500 uppercase">@{p.creator}</p></div><button onClick={(e) => { e.stopPropagation(); onSavePlaylist(p.id); }} className="text-orange-500"><Check className="w-5 h-5" /></button></div>))}
          </div></section>
        )}
      </div>
    </div>
  );
};

const PlaylistsView = ({ state, onPlayTrack, onCreateNew, onSavePlaylist, onDownloadTrack }: any) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) => setExpanded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const list = useMemo(() => {
    const created = state.playlists.filter((p: Playlist) => p.creator === state.currentUser?.username);
    const saved = state.playlists.filter((p: Playlist) => state.currentUser?.savedPlaylists.includes(p.id));
    return Array.from(new Set([...created, ...saved]));
  }, [state.playlists, state.currentUser]);

  return (
    <div className="space-y-10 px-2 pb-10">
      <div className="flex flex-col gap-6"><h2 className="text-3xl font-black italic text-orange-500 uppercase tracking-tighter">I TUOI SOUNDSCAPES</h2><button onClick={onCreateNew} className="w-full flex items-center justify-center gap-3 p-6 rounded-[2rem] bg-zinc-900 border border-dashed border-zinc-700 hover:border-orange-500 transition-all group font-black uppercase text-xs tracking-widest">+ Crea Soundscape</button></div>
      <div className="grid gap-6">
        {list.map(p => (
          <div key={p.id} className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden transition-all hover:border-zinc-600">
            <div onClick={() => toggle(p.id)} className="flex items-center gap-5 p-5 cursor-pointer hover:bg-zinc-800 transition-colors">
              <img src={p.coverUrl} className="w-16 h-16 object-cover rounded-2xl shadow-xl" alt="" />
              <div className="flex-1 min-w-0"><h3 className="font-black text-lg uppercase truncate">{p.name}</h3><p className="text-[10px] font-black text-zinc-500 uppercase">{p.tracks.length} tracce • {p.genres.join(', ')}</p></div>
              <div className="flex items-center gap-4">
                <button onClick={(e) => { e.stopPropagation(); if(p.tracks.length) onPlayTrack(state.tracks.find((t: Track) => t.id === p.tracks[0])!, p.tracks); }} className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"><Play className="w-5 h-5 fill-current ml-0.5" /></button>
                {expanded.includes(p.id) ? <ChevronUp className="text-zinc-500" /> : <ChevronDown className="text-zinc-500" />}
              </div>
            </div>
            {expanded.includes(p.id) && (
              <div className="p-4 border-t border-zinc-800 space-y-2 bg-black/40 animate-in slide-in-from-top-2 duration-300">
                {p.tracks.length > 0 ? p.tracks.map((tid: string) => {
                  const track = state.tracks.find((t: Track) => t.id === tid);
                  return track ? <TrackItem key={tid} track={track} onPlay={() => onPlayTrack(track, p.tracks)} isPlaying={state.currentTrack?.id === tid && state.isPlaying} onDownload={() => onDownloadTrack(track)} onAddToPlaylist={() => {}} onLike={() => {}} isLiked={state.currentUser?.likes.includes(tid)} /> : null;
                }) : <p className="text-[10px] text-zinc-600 uppercase font-black text-center py-6 italic">Vuoto.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const PlaylistModal = ({ track, state, setState, onClose }: any) => {
  const [mode, setMode] = useState<'select' | 'create'>(track ? 'select' : 'create');
  const [newName, setNewName] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const myPlaylists = state.playlists.filter((p: Playlist) => p.creator === state.currentUser?.username);

  const toggleGenre = (g: string) => {
    setSelectedGenres(p => p.includes(g) ? p.filter(x => x !== g) : (p.length < 3 ? [...p, g] : p));
  };

  const handleCreate = () => {
    if (!newName || !state.currentUser) return;
    const newPlaylist: Playlist = { id: `p_${Date.now()}`, name: newName, creator: state.currentUser.username, tracks: track ? [track.id] : [], genres: selectedGenres, coverUrl: `https://picsum.photos/seed/${newName}/400/400` };
    setState((prev: AppState) => ({ ...prev, playlists: [newPlaylist, ...prev.playlists] }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[2.5rem] p-8 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X /></button>
        <h3 className="text-xl font-black mb-6 uppercase tracking-tighter">{track ? `Aggiungi a...` : `Nuovo Soundscape`}</h3>
        {mode === 'select' ? (
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-hide">{myPlaylists.map((p: Playlist) => (<button key={p.id} onClick={() => { setState((prev: AppState) => ({ ...prev, playlists: prev.playlists.map(x => x.id === p.id && !x.tracks.includes(track.id) ? { ...x, tracks: [...x.tracks, track.id] } : x) })); onClose(); }} className="w-full flex items-center gap-4 p-3 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 transition-all border border-transparent hover:border-orange-500/30"><img src={p.coverUrl} className="w-12 h-12 rounded-lg object-cover" alt="" /><div className="text-left font-black text-sm uppercase">{p.name}</div></button>))}</div>
            <button onClick={() => setMode('create')} className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 font-black text-xs uppercase hover:text-white transition-all">+ Crea Nuovo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <input type="text" placeholder="Nome Playlist..." className="w-full bg-zinc-800 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500" value={newName} onChange={e => setNewName(e.target.value)} />
            <div className="space-y-2"><label className="text-[10px] font-black text-zinc-500 uppercase">Scegli Generi (Max 3)</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-black/20 rounded-2xl scrollbar-hide">{GENRES.map(g => (<button key={g} onClick={() => toggleGenre(g)} className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${selectedGenres.includes(g) ? 'bg-orange-500 border-orange-500 text-black' : 'border-zinc-700 text-zinc-500 hover:border-zinc-400'}`}>{g}</button>))}</div></div>
            <div className="flex gap-2"><button onClick={() => track ? setMode('select') : onClose()} className="flex-1 p-4 rounded-2xl font-black text-xs uppercase bg-zinc-800">Indietro</button><button onClick={handleCreate} className="flex-[2] p-4 rounded-2xl font-black text-xs uppercase bg-orange-600 hover:bg-orange-500 transition-colors">Crea</button></div>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsModal = ({ user, state, setState, onClose }: any) => {
  const [newPic, setNewPic] = useState(user.profilePic);
  const [newBio, setNewBio] = useState(user.bio);
  const [newName, setNewName] = useState(user.username);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-sm bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2.5rem] p-8 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X /></button>
        <h3 className="text-xl font-black mb-6 uppercase tracking-tighter">Impostazioni</h3>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 pb-4 border-b border-zinc-800">
            <div onClick={() => fileInputRef.current?.click()} className="relative w-24 h-24 rounded-full border-4 border-orange-500 overflow-hidden cursor-pointer group shadow-2xl">
              <img src={newPic} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white w-6 h-6" /></div>
            </div>
            <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setNewPic(r.result as string); r.readAsDataURL(f); } }} />
            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase text-orange-500">Cambia Foto Profilo</button>
          </div>
          <input type="text" className="w-full bg-black/40 p-4 rounded-2xl outline-none font-bold" value={newName} onChange={e => setNewName(e.target.value)} />
          <textarea rows={3} className="w-full bg-black/40 p-4 rounded-2xl outline-none font-medium text-sm" placeholder="La tua bio..." value={newBio} onChange={e => setNewBio(e.target.value)} />
          <button onClick={() => { setState((p:any) => ({ ...p, currentUser: {...user, username: newName, bio: newBio, profilePic: newPic}, registeredUsers: p.registeredUsers.map((u:any) => u.username === user.username ? {...u, username: newName, bio: newBio, profilePic: newPic} : u) })); onClose(); }} className="w-full bg-white text-black font-black p-4 rounded-2xl uppercase hover:bg-orange-500 transition-all shadow-xl">Salva Modifiche</button>
        </div>
      </div>
    </div>
  );
};

const InstagramTrackPost = ({ track, onPlay, isPlaying, onDownload, onAddToPlaylist, onShare, onLike, isLiked, onRepost, isReposted }: any) => (
  <article className="border-b border-zinc-900 pb-8 mb-4 relative">
    <div className="flex items-center justify-between mb-3 px-1"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-zinc-800"><img src={`https://picsum.photos/seed/${track.artist}/50/50`} className="w-full h-full object-cover" alt="" /></div><span className="text-sm font-bold text-zinc-100">@{track.artist}</span></div><MoreHorizontal className="w-5 h-5 text-zinc-500" /></div>
    <div className="relative group cursor-pointer aspect-square bg-zinc-900 overflow-hidden rounded-2xl shadow-2xl" onClick={onPlay}><img src={track.coverUrl} className={`w-full h-full object-cover transition-transform duration-[3s] ${isPlaying ? 'scale-110' : 'scale-100'}`} alt="" /><div className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><div className="w-16 h-16 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-2xl">{isPlaying ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 text-white fill-current ml-1" />}</div></div></div>
    <div className="px-1 mt-5">
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-1.5 group/like cursor-pointer" onClick={onLike}><Heart className={`w-6 h-6 transition-all ${isLiked ? 'text-red-500 fill-current scale-110' : 'text-zinc-100 group-hover/like:text-red-500'}`} /><span className={`text-[10px] font-black ${isLiked ? 'text-red-500' : 'text-zinc-500'}`}>{track.likesCount}</span></div>
        <div className="flex items-center gap-1.5 group/repost cursor-pointer" onClick={onRepost}><Repeat className={`w-6 h-6 transition-all ${isReposted ? 'text-green-500 scale-110' : 'text-zinc-100 group-hover/repost:text-green-500'}`} /><span className={`text-[10px] font-black ${isReposted ? 'text-green-500' : 'text-zinc-500'}`}>{track.repostsCount}</span></div>
        <PlusSquare onClick={onAddToPlaylist} className="w-6 h-6 text-zinc-100 hover:text-orange-500 hover:scale-110 transition-all cursor-pointer" /><Download onClick={onDownload} className="w-6 h-6 text-zinc-100 hover:text-white hover:scale-110 transition-all cursor-pointer" /><Share2 onClick={onShare} className="w-6 h-6 text-zinc-100 hover:text-blue-400 hover:scale-110 transition-all cursor-pointer" />
      </div>
      <div className="text-[13px] leading-tight"><span className="font-black mr-2 uppercase tracking-tighter">@{track.artist}</span><span className="text-zinc-300 font-medium">{track.title}</span></div>
    </div>
  </article>
);

const TrackItem = ({ track, onPlay, isPlaying, onDownload, onAddToPlaylist, isRepost, onLike, isLiked }: any) => (
  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-zinc-900 transition-all group relative">
    {isRepost && <div className="absolute -top-1 left-2 bg-green-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded uppercase flex items-center gap-1 z-10 shadow-lg"><Repeat className="w-2 h-2" /> Reposted</div>}
    <div className="relative w-14 h-14 flex-shrink-0 cursor-pointer" onClick={onPlay}><img src={track.coverUrl} className="w-full h-full object-cover rounded-lg shadow-lg" alt="" /><div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">{isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}</div></div>
    <div className="flex-1 min-w-0"><h4 className={`text-sm font-black uppercase tracking-tight truncate ${isPlaying ? 'text-orange-500' : ''}`}>{track.title}</h4><p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">@{track.artist}</p></div>
    <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      <Heart onClick={(e) => { e.stopPropagation(); onLike(); }} className={`w-4 h-4 cursor-pointer transition-all ${isLiked ? 'text-red-500 fill-current' : 'text-zinc-500 hover:text-red-500'}`} />
      <PlusSquare onClick={(e) => { e.stopPropagation(); if(onAddToPlaylist) onAddToPlaylist(); }} className="w-4 h-4 text-zinc-500 hover:text-orange-500 cursor-pointer transition-colors" />
      <Download onClick={(e) => { e.stopPropagation(); if(onDownload) onDownload(); }} className="w-4 h-4 text-zinc-500 hover:text-white cursor-pointer transition-colors" />
    </div>
  </div>
);

const AuthView = ({ state, setState, setView }: any) => {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const handleAuth = () => {
    if (!user || !password) return;
    const existing = state.registeredUsers.find(u => u.username === user);
    if (existing) { if (existing.password === password) { setState(p => ({ ...p, currentUser: existing })); setView('home'); } }
    else { const newUser: UserType = { username: user, password: password, profilePic: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop', bio: 'Nuovo Artista Libero', likes: [], reposts: [], playlists: [], savedPlaylists: [] }; setState(p => ({ ...p, currentUser: newUser, registeredUsers: [...p.registeredUsers, newUser] })); setView('home'); }
  };
  return (<div className="max-w-md mx-auto py-20 text-center space-y-8 animate-in zoom-in-95"><h2 className="text-4xl font-black italic tracking-tighter text-orange-500 uppercase">SOUNDFREE</h2><div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 space-y-4 shadow-2xl"><input type="text" placeholder="Username" className="w-full bg-black/40 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" value={user} onChange={e => setUser(e.target.value)} /><input type="password" placeholder="Password" className="w-full bg-black/40 p-4 rounded-2xl outline-none border border-transparent focus:border-orange-500 font-bold" value={password} onChange={e => setPassword(e.target.value)} /><button onClick={handleAuth} className="w-full bg-white text-black font-black p-4 rounded-2xl uppercase tracking-[0.2em] hover:bg-orange-500 transition-all shadow-lg mt-4">Entra</button></div></div>);
};

const PlaylistCardRight = ({ playlist, onSave, isSaved, onPlay }: any) => (
  <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3 transition-all hover:bg-zinc-900/50 group cursor-pointer shadow-lg relative" onClick={onPlay}>
    <button onClick={(e) => { e.stopPropagation(); onSave(); }} className={`absolute top-4 right-4 p-2 rounded-full backdrop-blur-md transition-all z-20 ${isSaved ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white'}`}>
      {isSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
    </button>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 flex-shrink-0 relative">
        <img src={playlist.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-5 h-5 text-white fill-current" /></div>
      </div>
      <div className="flex-1 min-w-0 pr-8">
        <h4 className="text-[13px] font-black text-zinc-100 group-hover:text-orange-500 truncate uppercase leading-tight transition-colors">{playlist.name}</h4>
        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">@{playlist.creator}</p>
      </div>
    </div>
  </div>
);

export default App;
