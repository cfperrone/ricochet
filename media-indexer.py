import eyed3
import os
import json

media_dir = '/home/cperrone/music/'
output_filename = media_dir + 'library.json'
songs = [ ]

# Song Indexes
artists = { }
albums = { }

def storeInIndex(song_id, song):
    artist_name = song['artist']
    album_name = song['album']
    track_num = song['track'][0]

    if song['artist'] in artists:
        artists[artist_name].append(song_id)
    else:
        artists[artist_name] = [song_id]

    if song['album'] in albums:
        albums[album_name][track_num] = song_id
    else:
        albums[album_name] = { track_num: song_id }

for root, dirs, files in os.walk(media_dir):
    path = root.split('/')
    #print (len(path) - 1) *'---' , os.path.basename(root)
    for file in files:
        #print len(path)*'---', file
        tmp_path = '/'.join(path) + '/' + file
        (root_path, ext) = os.path.splitext(tmp_path)
        if ext.lower() in ('.mp3'):
            try:
                id3 = eyed3.load(tmp_path)
                id3_title = id3.tag.title
                id3_artist = id3.tag.artist
                id3_album = id3.tag.album
                id3_track = id3.tag.track_num # this is a tuple! (track, total)
                print id3.tag.title + ' - ' + id3.tag.artist

                # Store the song info
                song_id = len(songs)
                song_dict = {
                    'title': id3_title,
                    'artist': id3_artist,
                    'album': id3_album,
                    'track': id3_track,
                    'path': tmp_path
                }
                songs.append(song_dict)

                # Store the song in the Artist and Album indexes
                storeInIndex(song_id, song_dict)
            except Exception as e:
                print e

print '--------'
for i, song in enumerate(songs):
    print "{0}: {1} - {2}".format(i, song['artist'], song['title'])
print "Artist count: {0}".format(len(artists))
print 'Album count: {0}'.format(len(albums))
print artists
print albums

output = {'songs': songs, 'artists': artists, 'albums': albums}
print json.dumps(output);

with open(output_filename, 'w') as f:
    json.dump(output, f)
