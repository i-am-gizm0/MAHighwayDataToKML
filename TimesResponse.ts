export interface TimesResponse {
    btdata: Btdata;
}
export interface Btdata {
    TRAVELDATA: TRAVELDATA;
}
export interface TRAVELDATA {
    LastUpdated: string;
    PAIRDATA?: (PAIRDATAEntity)[] | null;
}
export interface PAIRDATAEntity {
    Status: string;
    Highway: string;
    PairID: string;
    Title: string;
    Direction: string;
    Origin?: string | null;
    Routes?: Routes | null;
    Stale: string;
    TravelTime: string | number;
    Speed: string | number;
    FreeFlow?: number | string;
    onid?: number | string;
    Destination?: string | null;
    dnid?: number | string;
}
export interface Routes {
    Route?: (RouteEntity)[] | null;
}
export interface RouteEntity {
    lat: number;
    lon: number;
}

  