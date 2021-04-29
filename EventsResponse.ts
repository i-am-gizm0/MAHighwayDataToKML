export interface EventsResponse {
    ERSEvents: ERSEvents;
}
export interface ERSEvents {
    UpdateDate: string;
    Events: Events;
}
export interface Events {
    Event?: (EventEntity)[] | null;
}
export interface EventEntity {
    EventId: number;
    EventCreatedDate: string;
    EventStartDate: string;
    EventEndDate: string;
    LastUpdate: string;
    EventStatus: string;
    EventCategory: string;
    EventType: string;
    EventSubType: string;
    RoadwayName: string;
    Direction: string;
    LocationType: string;
    PrimaryLatitude: number | string;
    PrimaryLongitude: number | string;
    SecondaryLatitude: string | number;
    SecondaryLongitude: string | number;
    LocationDescription: string;
    LaneBlockageDescription: string;
    RecurrenceDescription: string;
}