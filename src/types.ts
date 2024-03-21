/* eslint-disable import/no-mutable-exports,no-undef */
declare let TRTCPeerConnection: {
    prototype: RTCPeerConnection;
    new(configuration?: RTCConfiguration): RTCPeerConnection;
    generateCertificate(keygenAlgorithm: AlgorithmIdentifier): Promise<RTCCertificate>;
};

declare let TMediaStream: {
    prototype: MediaStream;
    new(): MediaStream;
    new(stream: MediaStream): MediaStream;
    new(tracks: MediaStreamTrack[]): MediaStream;
};

declare let TRTCIceCandidate: {
    prototype: RTCIceCandidate;
    new(candidateInitDict?: RTCIceCandidateInit): RTCIceCandidate;
};

declare let TRTCSessionDescription: {
    prototype: RTCSessionDescription;
    new(descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
};

// statResultObj for non standard getStats func
export type StatResult = {
    names(): string[];
    stat(name: string): any;
    id: string;
    type: string;
    timestamp: number;
};

export {
    TRTCPeerConnection,
    TMediaStream,
    TRTCIceCandidate,
    TRTCSessionDescription,
};
