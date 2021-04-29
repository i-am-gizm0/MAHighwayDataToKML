const LINK_BASE = "https://<server>"

import express from 'express';
import fetch from "node-fetch";
import { j2xParser, parse, validate } from "fast-xml-parser";
import type { TimesResponse, PAIRDATAEntity } from './TimesResponse';
import { writeFileSync } from "fs";
import humanize from 'humanize-duration';
import { EventEntity, EventsResponse } from './EventsResponse';
import { prettyPrint } from 'human-date';
const app = express();

let timesData: TimesResponse;
let timesKML: { "@_xmlns": string; NetworkLinkControl: { minRefreshPeriod: number; maxSessionLength: number; linkName: string; }; Link: { href: string; refreshMode: string; refreshInterval: number; viewRefreshMode: string; }; Document: { name: string; open: number; Style: { "@_id": string; LineStyle: { color: string; colorMode: string; width: number; "gx:labelVisibility": number; "gx:physicalWidth": number; }; }[]; Placemark: { "@_id": string; name: string; visibility: number; description: string; styleUrl: string; "gx:labelVisibility": number; LineString: { "@_id": string; coordinates: string; }; }[]; }; };
let timesKMLString: string;

let eventsData: EventsResponse;
let eventsKML: { "@_xmlns": string; NetworkLinkControl: { minRefreshPeriod: number; maxSessionLength: number; linkName: string; }; Link: { href: string; refreshMode: string; refreshInterval: number; viewRefreshMode: string; }; Document: { name: string; open: number; Placemark: { [x: string]: string | number | { "@_id": string; extrude: number; coordinates: string; }; "@_id": number; name: string; visibility: number; open: number; description: string; }[]; }; };
let eventsKMLString: string;

app.get('/highwaytimes.kml', async (req, res) => {
    console.time('Response');
    res.type('.kml');
    await updateTimes();
    res.end(timesKMLString);
    console.log(`Sent ${Buffer.from(timesKMLString).length.toLocaleString()} bytes`);
    console.timeEnd('Response');
});

app.get('/highwayevents.kml', async (req, res) => {
    console.time('Response');
    res.type('.kml');
    await updateEvents();
    res.end(eventsKMLString);
    console.log(`Sent ${Buffer.from(eventsKMLString).length.toLocaleString()} bytes`);
    console.timeEnd('Response');
});

app.listen(3000, () => {
    console.log('listening on 3000');
});

async function updateTimes() {
    console.log('\nUpdating Times from Remote');
    console.time('fetch times');
    const serverResponse = await fetch(
        "https://dotfeeds.state.ma.us/api/RTTMDeveloperFeed/Index"
    );
    console.timeEnd('fetch times');
    if (!serverResponse.ok) {
        throw `Remote: ${serverResponse.status} ${
            serverResponse.statusText
        } ${await serverResponse.text()}`;
    }
    console.log(`Pulled from remote (${serverResponse.status} ${serverResponse.statusText})`);

    const xmlText = await serverResponse.text();

    console.time('validate and parse');
    if (validate(xmlText) !== true) {
        throw `Invalid XML\n${xmlText}`;
    }

    console.log('Parsing Response to JSON');

    timesData = parse(xmlText);
    console.timeEnd('validate and parse');

    console.log('Generate KML Tree');

    const parser = new j2xParser({
        ignoreAttributes: false,
    });
    timesKML = {
        "@_xmlns": "http://www.opengis.net/kml/2.2",
        "NetworkLinkControl": {
            "minRefreshPeriod": 60,
            "maxSessionLength": -1,
            "linkName": "MA Highway Times",
        },
        "Link": {
            "href": `${LINK_BASE}/highwaytimes.kml`,
            "refreshMode": "onInterval",
            "refreshInterval": 60,
            "viewRefreshMode": "never"
        },
        "Document": {
            "name": "MA Highway Times",
            "open": 1,
            "Style": [
                {
                    "@_id": "green",
                    "LineStyle": {
                        "color": "ff50af4c",
                        "colorMode": "normal",
                        "width": 4,
                        "gx:labelVisibility": 1,
                        "gx:physicalWidth": 9
                    }
                },
                {
                    "@_id": "yellow",
                    "LineStyle": {
                        "color": "ff3bebff",
                        "colorMode": "normal",
                        "width": 4,
                        "gx:labelVisibility": 1,
                        "gx:physicalWidth": 9
                    }
                },
                {
                    "@_id": "orange",
                    "LineStyle": {
                        "color": "ff0098ff",
                        "colorMode": "normal",
                        "width": 4,
                        "gx:labelVisibility": 1,
                        "gx:physicalWidth": 9
                    }
                },
                {
                    "@_id": "red",
                    "LineStyle": {
                        "color": "ff3643f4",
                        "colorMode": "normal",
                        "width": 4,
                        "gx:labelVisibility": 1,
                        "gx:physicalWidth": 9
                    }
                },
            ],
            "Placemark": timesData.btdata.TRAVELDATA.PAIRDATA.map(pairDataToPlacemark)
        }
    };
    console.log('Building KML');
    console.time('build kml');
    timesKMLString = parser.parse({kml: timesKML});
    console.timeEnd('build kml');
    
    console.log('Writing KML to highwaytimes.kml');
    writeFileSync('highwaytimes.kml', timesKMLString);
}

function pairDataToPlacemark(pair: PAIRDATAEntity) {
    const {Routes, ...smallData} = pair;
    if (!Routes) {
        return;
    }
    let speedMph = (typeof smallData.Speed == 'string' ? parseInt(smallData.Speed) : smallData.Speed) * 0.621371 || undefined;
    let speedMod = speedMph / (typeof smallData.FreeFlow == 'string' ? parseInt(smallData.FreeFlow) : smallData.FreeFlow);
    let color: string;
    if (speedMod >= 0.9) {
        color = "green";
    } else if (speedMod >= 0.75) {
        color = "yellow";
    } else if (speedMod >= 0.66) {
        color = "orange";
    } else if (!isNaN(speedMod)) {
        color = "red";
    }
    let description = `Travel time: ${
        pair.TravelTime && typeof pair.TravelTime == 'number' ?
        humanize(pair.TravelTime * 1000)
      : 'Unknown'
    }\nAvg. Speed: ${
        Math.round(speedMph * 10) / 10 || 'unknown'
    } mph (Limit: ${
        smallData.FreeFlow || 'unknown'
    }), ${Math.round(speedMod * 1000) / 10 || 'unknown' }% Speed limit`;
    let Placemark = {
        "@_id": pair.PairID,
        "name": pair.Title,
        "visibility": 1,
        description,
        "styleUrl": `#${color}`,
        "gx:labelVisibility": 1,
        "LineString": {
            "@_id": `LS-${pair.PairID}`,
            "coordinates": Routes.Route.map(point => `${point.lon},${point.lat}`).join(' ')   
        }
    }
    return Placemark;
}

updateTimes();
updateEvents();

async function updateEvents() {
    console.log('\nUpdating Events From Remote');
    console.time('fetch events');
    const serverResponse = await fetch(
        "https://dotfeeds.state.ma.us/api/ERSDeveloperFeed/Index"
    );
    console.timeEnd('fetch events');
    if (!serverResponse.ok) {
        throw `Remote: ${serverResponse.status} ${
            serverResponse.statusText
        } ${await serverResponse.text()}`;
    }
    console.log(`Pulled from remote (${serverResponse.status} ${serverResponse.statusText})`);

    const xmlText = await serverResponse.text();

    console.time('validate and parse');
    if (validate(xmlText) !== true) {
        throw `Invalid XML\n${xmlText}`;
    }

    console.log('Parsing Response to JSON');

    eventsData = parse(xmlText);
    console.timeEnd('validate and parse');
    // writeFileSync('events.json', JSON.stringify(eventsData));

    console.log('Generate KML Tree');

    const parser = new j2xParser({
        ignoreAttributes: false,
    });
    eventsKML = {
        "@_xmlns": "http://www.opengis.net/kml/2.2",
        "NetworkLinkControl": {
            "minRefreshPeriod": 60,
            "maxSessionLength": -1,
            "linkName": "MA Highway Events",
        },
        "Link": {
            "href": `${LINK_BASE}/highwayevents.kml`,
            "refreshMode": "onInterval",
            "refreshInterval": 60,
            "viewRefreshMode": "never"
        },
        "Document": {
            "name": "MA Highway Events",
            "open": 1,
            "Placemark": eventsData.ERSEvents.Events.Event.map(eventToPlacemark).filter(notUndefined)
        }
    };
    console.log('Building KML');
    console.time('build kml');
    eventsKMLString = parser.parse({kml: eventsKML});
    console.timeEnd('build kml');
    
    console.log('Writing KML to highwayevents.kml');
    writeFileSync('highwayevents.kml', eventsKMLString);
}

function eventToPlacemark(event: EventEntity) {
    if (!event.PrimaryLatitude && !event.PrimaryLongitude) {
        return null;
    }
    let name = `${event.EventCategory}: ${event.EventSubType} on ${event.RoadwayName}${event.Direction || ''}`;
    let description = `Event Created: ${
        prettyPrint(event.EventCreatedDate, {showTime: true})
    }${
        event.EventStartDate ? `\nEvent Start: ${prettyPrint(normalizeDates(event.EventStartDate), {showTime: true})}` : ''
    }${
        event.EventEndDate ? `\nEvent End: ${prettyPrint(normalizeDates(event.EventEndDate), {showTime: true})}` : ''
    }${
        event.LastUpdate ? `\nLast Update: ${prettyPrint(event.LastUpdate, {showTime: true})}` : ''
    }\n${
        event.LocationDescription
    }\n${
        event.LaneBlockageDescription
    }${
        event.RecurrenceDescription ? `\n${event.RecurrenceDescription}` : ''
    }`;
    let type: 'Point' | 'LineString' = event.LocationType == 'Point' || (event.LocationType == 'Linear' && event.SecondaryLatitude == '') ? 'Point' : 'LineString';
    let geometry: { "@_id": string; extrude: number; coordinates: string; };
    switch (type) {
        case 'Point':
            geometry = {
                "@_id": `geo-${event.EventId}`,
                "extrude": 0,
                "coordinates": `${event.PrimaryLongitude},${event.PrimaryLatitude}`
            }
            break;

        case 'LineString':
            geometry = {
                "@_id": `geo-${event.EventId}`,
                "extrude": 0,
                "coordinates": `${event.PrimaryLongitude},${event.PrimaryLatitude} ${event.SecondaryLongitude},${event.SecondaryLatitude}`
            }
            break;
    }
    let placemark = {
        "@_id": event.EventId,
        name,
        "visibility": 1,
        "open": 1,
        description,
        [type]: geometry
    };
    return placemark;
}

function notUndefined(value: any) {
    return value != undefined && value != null;
}

function normalizeDates(dateString: string) {
    let atMatch = dateString.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}) at ([0-9]{2}:[0-9]{2})/);
    if (atMatch) {
        return `${atMatch[1]}T${atMatch[2]}:00`;
    } else {
        return dateString;
    }
}