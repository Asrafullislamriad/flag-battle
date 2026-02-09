const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

let ffmpegCommand = null;
let streamInput = null;

module.exports = {
    startStream: (streamKey, options, onLog, onError) => {
        if (ffmpegCommand) {
            console.log('⚠️ Stream already running');
            return;
        }

        const bitrate = options.bitrate || '4500k';
        const bufsize = (parseInt(bitrate) * 2) + 'k';

        console.log(`🚀 Starting Stream with bitrate: ${bitrate}, bufsize: ${bufsize}`);

        // Create a PassThrough stream to feed data to ffmpeg
        streamInput = new PassThrough();

        ffmpegCommand = ffmpeg()
            .input(streamInput)
            .inputFormat('webm') // Browser MediaRecorder sends WebM
            .inputOptions([
                '-thread_queue_size 1024' // Increase input buffer
            ])
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
                '-preset veryfast', // Low CPU usage
                '-tune zerolatency', // Low latency
                '-g 60', // Keyframe interval (2s for 30fps)
                `-b:v ${bitrate}`, // Dynamic Video bitrate
                `-maxrate ${bitrate}`, // Cap bitrate
                `-bufsize ${bufsize}`, // Buffer size (2x bitrate)
                '-pix_fmt yuv420p', // Standard pixel format
                '-b:a 128k', // Audio bitrate
                '-f flv', // RTMP format
                '-flvflags no_duration_filesize' // Fix for some RTMP servers
            ])
            .output(`rtmp://a.rtmp.youtube.com/live2/${streamKey}`)
            .on('start', (commandLine) => {
                console.log('🎥 FFmpeg started:', commandLine);
                if (onLog) onLog('Stream started');
            })
            .on('error', (err, stdout, stderr) => {
                console.error('❌ Stream Error:', err.message);
                console.error('FFmpeg stderr:', stderr);
                if (onError) onError(err.message);
                module.exports.stopStream();
            })
            .on('end', () => {
                console.log('🛑 Stream ended');
                if (onLog) onLog('Stream ended');
                module.exports.stopStream();
            });

        ffmpegCommand.run();
    },

    writeToStream: (buffer) => {
        if (streamInput && !streamInput.destroyed) {
            streamInput.write(buffer);
        }
    },

    stopStream: () => {
        if (ffmpegCommand) {
            console.log('🛑 Stopping Stream...');
            try {
                ffmpegCommand.kill();
            } catch (e) {
                console.error('Error killing ffmpeg:', e);
            }
            ffmpegCommand = null;
        }

        if (streamInput) {
            streamInput.end(); // Close the stream
            streamInput.destroy();
            streamInput = null;
        }
    }
};
