export const EVENT_SOURCES = [
  { id:"trinity-boston", name:"Trinity Church Boston", url:"https://trinitychurchboston.org/music/organ-recitals/", alternateUrl:"https://trinitychurchboston.org/wp-json/tribe/events/v1/events?per_page=50", parser:"trinity", city:"Boston", region:"MA", address:"206 Clarendon Street, Boston, MA 02116", imageUrl:"https://trinitychurchboston.org/wp-content/uploads/2016/11/FATBanner-1024x252.jpg" },
  { id:"harvard-memorial", name:"Harvard Memorial Church", url:"https://memorialchurch.harvard.edu/calendar", parser:"harvard", city:"Cambridge", region:"MA", address:"The Memorial Church, 1 Harvard Yard, Cambridge, MA 02138" },
  { id:"methuen", name:"Methuen Memorial Music Hall", url:"https://mmmh.org/", parser:"jsonld", city:"Methuen", region:"MA", address:"192 Broadway, Methuen, MA 01844" },
  { id:"boston-ago", name:"Boston Chapter, American Guild of Organists", url:"https://www.bostonago.org/chapter-events-sep", parser:"ago", extraUrls:["https://www.bostonago.org/chapter-events-jan"], city:"Boston", region:"MA" }
];
