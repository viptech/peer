/* eslint-disable lines-between-class-members,no-undef,no-underscore-dangle */
import { EventEmitter } from 'events';
import { v4 } from 'uuid';

import { TRTCPeerConnection, TMediaStream, TRTCIceCandidate, TRTCSessionDescription } from './types';

const sessionConstraints = {
    mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true,
        VoiceActivityDetection: true,
    },
};

type TOptions = {
    initiator: boolean
    streams: MediaStream[],
    stream: MediaStream,
    wrtc: {
        RTCPeerConnection: typeof TRTCPeerConnection,
        RTCIceCandidate: typeof TRTCIceCandidate,
        RTCSessionDescription: typeof TRTCSessionDescription,
        // RTCView,
        MediaStream: typeof TMediaStream,
        MediaStreamTrack: MediaStreamTrack,
        // mediaDevices,
    }
    config: RTCConfiguration,
    channelConfig?: RTCDataChannelInit,
    offerOptions?: RTCOfferOptions,
    answerOptions?: RTCAnswerOptions,
    channelName?: string,
    consoleLog: (...args: any[]) => void,
}

class HelsiPeer extends EventEmitter {
    private readonly initiator: boolean;
    private readonly wrtc: {
        RTCPeerConnection: typeof TRTCPeerConnection
        RTCIceCandidate: typeof TRTCIceCandidate,
        RTCSessionDescription: typeof TRTCSessionDescription,
        MediaStream: typeof TMediaStream,
        MediaStreamTrack: MediaStreamTrack,
    };
    private readonly streams: MediaStream[];
    private readonly config?: RTCConfiguration;
    private readonly channelConfig: RTCDataChannelInit | undefined;
    private readonly channelNegotiated: boolean;
    private readonly offerOptions: RTCOfferOptions | {};
    private readonly answerOptions: RTCAnswerOptions | {};
    private peerConnection: RTCPeerConnection | null;
    private readonly channelName: string | null;
    private remoteCandidates: RTCIceCandidate[];
    private remoteMediaStream: MediaStream | null;
    private _channel: RTCDataChannel | null;
    private destroyed: boolean;
    private destroying: boolean;
    private getStats: (cb: (err: string | null, reports?: any[]) => void) => void;
    private consoleLog: (...args: any[]) => void;

    constructor(options: TOptions) {
        super();
        this.initiator = options.initiator;
        this.wrtc = options.wrtc;
        this.config = options.config;
        this.channelConfig = options.channelConfig || undefined;
        this.channelNegotiated = !!this.channelConfig?.negotiated;
        this.streams = options.streams || (options.stream ? [options.stream] : []);
        this.offerOptions = options.offerOptions || {};
        this.answerOptions = options.answerOptions || {};
        this.peerConnection = new this.wrtc.RTCPeerConnection(this.config);
        this.channelName = options.initiator ? options.channelName || v4() : null;
        this.remoteCandidates = [];
        this.remoteMediaStream = null;
        this._channel = null;

        this.destroyed = false;
        this.destroying = false;

        this.consoleLog = options.consoleLog;
        this.getStats = cb => {
            this._getStats(cb);
        };

        this.peerConnection.addEventListener('connectionstatechange', () => {
            this._onConnectionStateChange();
        });

        this.peerConnection.addEventListener('icecandidate', event => {
            this._onIceCandidate(event);
        });

        this.peerConnection.addEventListener('icecandidateerror', error => {
            // this._onError(error);
        });

        this.peerConnection.addEventListener('iceconnectionstatechange', () => {
            this._onIceConnectionStateChange();
        });

        this.peerConnection.addEventListener('negotiationneeded', event => {
            this._onNegotiationNeeded(event).then();
            // You can start the offer stages here.
            // Be careful as this event can be called multiple times.
        });

        this.peerConnection.addEventListener('signalingstatechange', () => {
            this._onSignalStateChange();
        });

        this.peerConnection.addEventListener('track', event => {
            this._onTrack(event);
        });

        if (this.initiator || this.channelNegotiated) {
            this.channelName && this._onCreateDataChanel({
                channel: this.peerConnection.createDataChannel(this.channelName, this.channelConfig),
            });
        } else {
            this.peerConnection.ondatachannel = event => {
                this._onCreateDataChanel(event);
            };
        }

        this._start()
            .then(r => {
                this.consoleLog('start then', r);
            })
            .catch(err => {
                this.consoleLog(`ERROR catch start, ${err}`);
            });
    }

    async _start() {
        try {
            await this._addLocalStream();
        } catch (error) {
            this.consoleLog('ERROR -> start', error);
        }
    }

    async _addLocalStream() {
        try {
            this.streams.forEach(_stream => {
                this.addStream(_stream);
            });
        } catch (error) {
            this.consoleLog('ERROR -> _addLocalStream', error);
        }
    }

    _onCreateDataChanel(_event: {channel: RTCDataChannel}) {
        this.consoleLog('PEER -> _onCreateDataChanel', _event);
        this._channel = _event.channel;

        this._channel.onmessage = message => {
            this._onChannelMessage(message);
        };
    }

    _onChannelMessage(message: MessageEvent) {
        this.consoleLog('message', message);
        this.emit('data', message?.data);
    }

    async _onNegotiationNeeded(event) {
        try {
            this.consoleLog('onNegotiationNeeded', event);
            if (this.initiator) {
                await this.createOffer();
            } else {
                this.emit('signal', {
                    // request initiator to renegotiate
                    type: 'renegotiate',
                    renegotiate: true,
                });
            }
        } catch (error) {
            this.consoleLog('ERROR -> _onNegotiationNeeded', error);
        }
    }

    _onConnectionStateChange() {
        try {
            this.consoleLog('_onConnectionStateChange', this.peerConnection?.connectionState);
            switch (this.peerConnection?.connectionState) {
                case 'connected':
                    this.emit('connect');
                    break;
                case 'closed':
                    this.peerConnection.close();
                    this.peerConnection = null;
                    this.emit('close');
                    break;
                default:
                    break;
            }
        } catch (error) {
            this.consoleLog('ERROR -> _onConnectionStateChange', error);
        }
    }

    _onSignalStateChange() {
        this.consoleLog('_onSignalStateChange', this.peerConnection?.signalingState);
    }

    _onTrack(event: RTCTrackEvent) {
        try {
            this.consoleLog('_onTrack', event);
            this.remoteMediaStream = (this.remoteMediaStream || new this.wrtc.MediaStream()) as MediaStream;
            this.remoteMediaStream.addTrack(event.track);
            // this.emit('stream', event.stream);
            this.emit('stream', this.remoteMediaStream);
        } catch (error) {
            this.consoleLog('ERROR -> _onTrack', error);
        }
    }

    _onIceCandidate(event) {
        try {
            this.consoleLog('_onIceCandidate', event);
            this.peerConnection && this.consoleLog('ice state', this.peerConnection.iceConnectionState);
            // When you find a null candidate then there are no more candidates.
            // Gathering of candidates has finished.
            if (!event.candidate) {
                return;
            }
            // const iceCandidate = new this.wrtc.RTCIceCandidate(event.candidate);
            //
            // this.consoleLog('this.peerConnection.remoteDescription', this.peerConnection.remoteDescription);
            // if (this.peerConnection.remoteDescription === null) {
            //   this.consoleLog('push on future', iceCandidate);
            //   this.remoteCandidates.push(iceCandidate);
            // } else {
            //   this.consoleLog('set immediately ');
            //   this.peerConnection.addIceCandidate(iceCandidate);
            // }

            this.emit('signal', {
                type: 'candidate',
                candidate: {
                    candidate: event.candidate.candidate,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                },
            });

            // Send the event.candidate onto the person you're calling.
            // Keeping to Trickle ICE Standards, you should send the candidates immediately.
        } catch (error) {
            this.consoleLog('ERROR -> _onIceCandidate', error);
        }
    }

    _onError(error) {
        try {
            this.consoleLog('_onError', error);
            this.peerConnection && this.peerConnection.close();
            this.peerConnection = null;
            this.emit('error', error);
        } catch (_error) {
            this.consoleLog('ERROR -> _onError', _error);
        }
    }

    _onIceConnectionStateChange() {
        try {
            this.peerConnection && this.consoleLog('_onIceConnectionStateChange', this.peerConnection.iceConnectionState);
            switch (this.peerConnection?.iceConnectionState) {
                case 'connected':
                case 'completed':
                default:
                    break;
            }
        } catch (error) {
            this.consoleLog('ERROR -> _onIceConnectionStateChange', error);
        }
    }

    addStream(_stream: MediaStream) {
        try {
            if (this.destroying) {
                return;
            }
            this.consoleLog('addStream');
            if (this.peerConnection) {
                _stream.getTracks().forEach(track => (this.peerConnection as RTCPeerConnection).addTrack(track, _stream));
            }
        } catch (error) {
            this.consoleLog('ERROR -> addStream', error);
        }
    }

    async _addIceCandidate(candidate) {
        try {
            this.consoleLog('_addIceCandidate');
            const iceCandidate = new this.wrtc.RTCIceCandidate(candidate);
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(iceCandidate);
            }
        } catch (e) {
            this.consoleLog('ERROR _addIceCandidate', e);
        }
    }

    async signal(data) {
        this.consoleLog('----------- signal------------', data);
        try {
            if (data?.renegotiate && this.initiator) {
                this.consoleLog('----------- signal------------ _needsNegotiation');
                await this.negotiate();
            }

            if (data?.candidate) {
                this.consoleLog('----------- signal------------ candidate');
                if (
                    this.peerConnection?.remoteDescription
                    && this.peerConnection?.remoteDescription?.type
                ) {
                    await this._addIceCandidate(data.candidate);
                } else {
                    this.remoteCandidates.push(data.candidate);
                }
            }

            if (data?.sdp) {
                const offerDescription = new this.wrtc.RTCSessionDescription(data);
                if (this.peerConnection) {
                    await this.peerConnection.setRemoteDescription(offerDescription);

                    if (this.peerConnection.remoteDescription?.type === 'offer') {
                        this.consoleLog(
                            '----------- receive signal------------ create Answer',
                            this.peerConnection.remoteDescription?.type,
                        );
                        await this.createAnswer(data);
                    }

                    this.remoteCandidates.map(candidate => (this.peerConnection as RTCPeerConnection).addIceCandidate(candidate));
                    this.remoteCandidates = [];
                }
            }
        } catch (error) {
            this.consoleLog('ERROR -> signal', error);
        }
    }

    send(string: string) {
        this.consoleLog('PEER -> send');
        try {
            this._channel?.send(string);
        } catch (error) {
            this.consoleLog('PEER -> error', error);
        }
    }

    async negotiate() {
        this.consoleLog('negotiate');
        if (this.initiator) {
            await this.createOffer();
        } else {
            this.emit('signal', {
                // request initiator to renegotiate
                type: 'renegotiate',
                renegotiate: true,
            });
        }
    }

    async createOffer() {
        try {
            if (this.peerConnection !== null) {
                this.consoleLog('createOffer');
                const offerDescription = await this.peerConnection.createOffer(this.offerOptions);
                this.consoleLog('offerDescription', offerDescription);
                await this.peerConnection.setLocalDescription(offerDescription);
                this.emit('signal', {
                    type: offerDescription?.type,
                    sdp: offerDescription?.sdp,
                });
            } else {
                throw new Error('peerConnection is null');
            }
        } catch (error) {
            this.consoleLog('ERROR -> createOffer', error);
        }
    }

    async createAnswer(_offerDescription) {
        try {
            if (this.peerConnection !== null) {
                this.consoleLog('receiveOffer');
                const answerDescription = await this.peerConnection.createAnswer(_offerDescription);
                await this.peerConnection.setLocalDescription(answerDescription);
                this.emit('signal', {
                    type: answerDescription.type,
                    sdp: answerDescription.sdp,
                });
            } else {
                throw new Error('peerConnection is null');
            }
        } catch (error) {
            this.consoleLog(`ERROR -> receiveOffer ${error}`);
        }
    }

    destroy() {
        if (this.destroyed || this.destroying) return;

        try {
            this.peerConnection && this.peerConnection.close();
            this.peerConnection = null;
        } catch (error) {
            this.consoleLog('ERROR -> destroy', error);
        }
    }

    _getStats = (cb: (err: string | null, reports?: any[]) => void) => {
        this.consoleLog('PEER -> getStats');
        const flattenValues = report => {
            if (Object.prototype.toString.call(report.values) === '[object Array]') {
                report.values.forEach(value => {
                    Object.assign(report, value);
                });
            }
            return report;
        };
        if (this.peerConnection) {
            if (this.peerConnection.getStats.length === 0) {
                this.peerConnection.getStats()
                    .then(res => {
                        const reports: any[] = [];
                        res.forEach(report => {
                            reports.push(flattenValues(report));
                        });
                        cb(null, reports);
                    })
                    .catch(err => cb(err));

                // Single-parameter callback-based getStats() (non-standard)
            } else if (this.peerConnection.getStats.length > 0) {
                // @ts-ignore for non standart browsers
                this.peerConnection.getStats(res => {
                    // If we destroy connection in `connect` callback this code might happen to run when actual connection is already closed
                    if (this.destroyed) return;

                    const reports:any[] = [];
                    res.result().forEach(result => {
                        const report: any = {};
                        result.names().forEach(name => {
                            report[name] = result.stat(name);
                        });
                        report.id = result.id;
                        report.type = result.type;
                        report.timestamp = result.timestamp;
                        reports.push(flattenValues(report));
                    });
                    cb(null, reports);
                    // @ts-ignore for non standart browsers
                }, err => cb(err));

                // Unknown browser, skip getStats() since it's anyone's guess which style of
                // getStats() they implement.
            }
            cb(null);
        }
    };
}

export default HelsiPeer;
