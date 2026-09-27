import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Bell, ChevronDown, CloudRain, Database, Gauge, Home, Info, Map,
  Menu, Radio, RefreshCw, Send, ShieldAlert, Siren, TriangleAlert,
  Waves, Wifi, X, FileWarning, History, Activity
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const rainfallData = [
  {t:'00',v:2},{t:'02',v:4},{t:'04',v:3},{t:'06',v:7},{t:'08',v:10},{t:'10',v:18},
  {t:'12',v:24},{t:'14',v:16},{t:'16',v:8},{t:'18',v:5},{t:'20',v:3},{t:'22',v:2}
]
const monthlyData = [
  {m:'Jan',v:34},{m:'Feb',v:28},{m:'Mar',v:45},{m:'Apr',v:66},{m:'May',v:128},
  {m:'Jun',v:241},{m:'Jul',v:318},{m:'Aug',v:276},{m:'Sep',v:194}
]

async function api(path, options={}) {
  const r = await fetch(API + path, {
    headers: {'Content-Type':'application/json', ...(options.headers||{})},
    ...options
  })
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

function App(){
  const [page,setPage]=useState('dashboard')
  const [region,setRegion]=useState('East Sikkim')
  const [locations,setLocations]=useState([])
  const [sensors,setSensors]=useState([])
  const [alerts,setAlerts]=useState([])
  const [incidents,setIncidents]=useState([])
  const [prediction,setPrediction]=useState(null)
  const [loading,setLoading]=useState(false)
  const [online,setOnline]=useState(true)
  const [toast,setToast]=useState('')
  const [mobileOpen,setMobileOpen]=useState(false)

  const notify=(m)=>{setToast(m);setTimeout(()=>setToast(''),2500)}

  async function load(){
    setLoading(true)
    try{
      const [l,s,a,i]=await Promise.all([
        api('/locations'), api('/sensors'), api('/alerts'), api('/incidents')
      ])
      setLocations(l);setSensors(s);setAlerts(a);setIncidents(i);setOnline(true)
    }catch(e){
      setOnline(false); notify('Backend not reachable. Start FastAPI on port 8000.')
    }finally{setLoading(false)}
  }

  useEffect(()=>{load()},[])
  useEffect(()=>{
    const queued=JSON.parse(localStorage.getItem('geoguard_queue')||'[]')
    if(navigator.onLine && queued.length) syncQueue()
    const on=()=>{setOnline(true);syncQueue()}
    const off=()=>setOnline(false)
    window.addEventListener('online',on);window.addEventListener('offline',off)
    return ()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}
  },[])

  async function syncQueue(){
    const q=JSON.parse(localStorage.getItem('geoguard_queue')||'[]')
    if(!q.length) return
    const remaining=[]
    for(const item of q){
      try{await api('/incidents',{method:'POST',body:JSON.stringify(item)})}
      catch{remaining.push(item)}
    }
    localStorage.setItem('geoguard_queue',JSON.stringify(remaining))
    if(!remaining.length){notify('Offline reports synchronized with backend');load()}
  }

  async function runPrediction(){
    setLoading(true)
    try{
      const p=await api('/prediction',{method:'POST',body:JSON.stringify({
        rainfall_24h:86.4,soil_moisture:78.6,slope:31.8,water_level:3.8,historical_risk:72
      })})
      setPrediction(p);notify('New risk prediction generated')
    }catch{notify('Prediction API unavailable')}
    finally{setLoading(false)}
  }

  async function sendTest(){
    try{await api('/alerts/test',{method:'POST'});notify('Test alert sent by backend')}
    catch{notify('Backend unavailable')}
  }

  function nav(p){
    setPage(p);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'})
  }

  const activeAlerts=alerts.filter(a=>a.status==='active').length

  return <div className="app">
    <header className="topbar">
      <div className="brand">
        <button className="mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X/>:<Menu/>}</button>
        <div className="logo">G</div>
        <div><b>GeoGuard</b><small>Flash Flood Early Warning System</small></div>
      </div>
      <div className="top-right">
        <span className={online?'connection online':'connection'}><i></i>{online?'Backend Connected':'Backend Offline'}</span>
        <span className="clock">{new Date().toLocaleTimeString('en-IN',{hour12:false})}</span>
        <Bell size={17}/>
        <div className="avatar">GH</div>
      </div>
    </header>

    <aside className={mobileOpen?'sidebar open':'sidebar'}>
      <div className="region">
        <Map size={18}/>
        <div><small>MONITORING REGION</small><b>{region}</b></div>
        <select value={region} onChange={e=>setRegion(e.target.value)}>
          {locations.map(x=><option key={x.id}>{x.name}</option>)}
        </select>
      </div>
      <NavItem icon={<Home/>} label="Dashboard" active={page==='dashboard'} onClick={()=>nav('dashboard')}/>
      <NavItem icon={<Gauge/>} label="Risk Prediction" active={page==='prediction'} onClick={()=>nav('prediction')}/>
      <NavItem icon={<Map/>} label="Risk Map" active={page==='map'} onClick={()=>nav('map')}/>
      <NavItem icon={<Radio/>} label="IoT Sensors" active={page==='sensors'} onClick={()=>nav('sensors')}/>
      <NavItem icon={<Siren/>} label="Early Alerts" badge={activeAlerts} active={page==='alerts'} onClick={()=>nav('alerts')}/>
      <div className="nav-title">DATA & REPORTS</div>
      <NavItem icon={<History/>} label="Historical Data" active={page==='history'} onClick={()=>nav('history')}/>
      <NavItem icon={<FileWarning/>} label="Incident Reports" active={page==='incidents'} onClick={()=>nav('incidents')}/>
      <div className="nav-title">SYSTEM</div>
      <NavItem icon={<Info/>} label="About System" active={page==='about'} onClick={()=>nav('about')}/>
      <div className="sync-box"><div><Wifi size={14}/> Data Sync</div><b>{online?'Connected':'Offline'}</b><small>{online?'Live API connection':'Reports stored locally'}</small></div>
    </aside>

    <main className="main">
      {page==='dashboard' && <Dashboard region={region} sensors={sensors} alerts={alerts} onPredict={()=>nav('prediction')} refresh={load} loading={loading}/>}
      {page==='prediction' && <Prediction prediction={prediction} run={runPrediction} loading={loading}/>}
      {page==='map' && <RiskMap region={region}/>}
      {page==='sensors' && <Sensors sensors={sensors} refresh={load}/>}
      {page==='alerts' && <Alerts alerts={alerts} sendTest={sendTest}/>}
      {page==='history' && <HistoryPage/>}
      {page==='incidents' && <Incidents incidents={incidents} online={online} reload={load} notify={notify}/>}
      {page==='about' && <About/>}
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function NavItem({icon,label,badge,active,onClick}){return <button className={active?'nav active':'nav'} onClick={onClick}>{icon}<span>{label}</span>{badge>0&&<em>{badge}</em>}</button>}

function Dashboard({region,sensors,alerts,onPredict,refresh,loading}){
  const onlineSensors=sensors.filter(x=>x.status==='online').length
  return <PageHead eyebrow="DISASTER MONITORING CENTER" title="Regional Overview" sub={`Hyper-local flash flood monitoring for ${region}.`} actions={<><Button secondary onClick={refresh}><RefreshCw size={14}/>Refresh</Button><Button onClick={onPredict}>Run Prediction →</Button></>}>
    <div className="stats">
      <Stat icon={<CloudRain/>} title="Rainfall · 24h" value="86.4 mm" note="↑ 18.2% from average" good/>
      <Stat icon={<Waves/>} title="Soil Moisture" value="78.6%" note="High saturation" warn/>
      <Stat icon={<Radio/>} title="Active Sensors" value={`${onlineSensors || 42} / 45`} note="Operational nodes" good/>
      <Stat icon={<TriangleAlert/>} title="Risk Level" value="HIGH" note="Updated just now" danger/>
    </div>
    <div className="two-col">
      <Panel title="Rainfall Trend" sub="Last 24 hours · mm"><div className="chart"><ResponsiveContainer><LineChart data={rainfallData}><CartesianGrid vertical={false} stroke="#edf1f5"/><XAxis dataKey="t" tick={{fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:9}} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="v" stroke="#1769e0" strokeWidth={2} dot={{r:2}}/></LineChart></ResponsiveContainer></div></Panel>
      <Panel title="Current Risk Assessment" sub="Multi-factor analysis"><RiskBox/></Panel>
    </div>
    <div className="two-col">
      <Panel title="Latest Early Warnings" sub="Location-based alerts"><div>{alerts.slice(0,3).map(a=><Warning key={a.id} a={a}/>)}</div></Panel>
      <Panel title="Sensor Network" sub="Real-time status"><div className="sensor-network"><div className="donut"><span>93%</span></div><div><p>🟢 Online <b>42</b></p><p>🟠 Warning <b>2</b></p><p>⚪ Offline <b>1</b></p></div></div><div className="mini-row"><span>Rain gauges</span><b>15 / 15</b></div><div className="mini-row"><span>Soil moisture</span><b>13 / 15</b></div></Panel>
    </div>
  </PageHead>
}

function RiskBox(){return <div className="risk-box"><div className="score">78<small>/100</small></div><div><b>High Flood Risk</b><p>Elevated flash flood potential detected.</p><div className="bars"><span>Rainfall <i style={{width:'84%'}}/></span><span>Soil saturation <i style={{width:'79%'}}/></span><span>Slope stability <i style={{width:'58%'}}/></span></div></div></div>}

function Prediction({prediction,run,loading}){
 const p=prediction
 return <PageHead eyebrow="PREDICTIVE ANALYTICS" title="Flash Flood Risk Prediction" sub="Combine rainfall, soil moisture, slope, water level and historical risk." actions={<Button onClick={run} disabled={loading}>{loading?'Running...':'▶ Run New Prediction'}</Button>}>
  <div className="prediction-hero"><div className="big-score">{p?p.risk_score:78}<small>/100</small><span>{p?p.risk_level:'HIGH'} RISK</span></div><div><h2>{p?.risk_level==='LOW'?'Lower risk conditions':p?.risk_level==='MODERATE'?'Moderate flood conditions':'Elevated flash flood conditions detected'}</h2><p>The backend risk engine combines multiple environmental factors. The current interface uses a transparent weighted demo model that can later be replaced with a trained ML model.</p><div className="lead"><b>⏱ Estimated lead time</b><strong>{p?.lead_time||'45–90 minutes'}</strong></div></div></div>
  <div className="section-title"><h2>Risk Factors</h2><span>Current demonstration measurements</span></div>
  <div className="factor-grid">{[['Rainfall','86.4 mm',86],['Soil Moisture','78.6%',79],['Slope','31.8°',68],['Water Level','3.8 m',63],['Historical Risk','High',72],['Sensor Confidence','93%',93]].map(x=><div className="factor" key={x[0]}><div><span>{x[0]}</span><b>{x[1]}</b></div><div className="meter"><i style={{width:x[2]+'%'}}/></div></div>)}</div>
  <div className="recommend"><ShieldAlert size={22}/><div><b>Recommended response</b><p>Verify vulnerable settlements, keep evacuation routes clear, notify local authorities and prepare community-level warning messages.</p></div></div>
 </PageHead>
}

function RiskMap({region}){
 const [selected,setSelected]=useState(null)
 const points=[['Singhik',23,33,'HIGH',78],['Rumtek',70,29,'MODERATE',54],['Gangtok',57,69,'LOW',28],['Ranka',76,65,'HIGH',73]]
 return <PageHead eyebrow="GIS MONITORING" title="Hyper-Local Risk Map" sub={`Risk zones and monitoring points for ${region}.`}>
  <div className="map-layout"><div className="map"><div className="terrain t1"/><div className="terrain t2"/><div className="river"/><div className="zone high-zone"/><div className="zone mod-zone"/>
   {points.map(p=><button key={p[0]} className={`pin ${p[3].toLowerCase()}`} style={{left:p[1]+'%',top:p[2]+'%'}} onClick={()=>setSelected(p)}>●</button>)}
   <div className="north">N<br/>▲</div><div className="map-scale">1 km</div>
  </div><Panel title="Map Legend" sub="Select a marker"><Legend color="high" text="High risk zone"/><Legend color="moderate" text="Moderate risk zone"/><Legend color="low" text="Low risk zone"/><hr/>{selected?<><small>SELECTED LOCATION</small><h3>{selected[0]}</h3><p>Risk: <b>{selected[3]}</b><br/>Score: <b>{selected[4]}/100</b><br/>Monitoring status: Active</p></>:<p>Click a map marker to view current location risk.</p>}</Panel></div>
 </PageHead>
}
function Legend({color,text}){return <div className="legend"><i className={color}/>{text}</div>}

function Sensors({sensors,refresh}){
 return <PageHead eyebrow="INTERNET OF THINGS" title="IoT Sensor Network" sub="Monitor environmental field devices and their latest readings." actions={<Button secondary onClick={refresh}><RefreshCw size={14}/>Refresh</Button>}>
  <div className="stats"><Stat title="Active Nodes" value="42" note="of 45 deployed"/><Stat title="Average Battery" value="84%" note="Healthy" good/><Stat title="Data Packets" value="98.7%" note="Received" good/><Stat title="Last Update" value="2 min" note="ago"/></div>
  <Panel title="Field Sensor Status" sub={`${sensors.length || 8} representative nodes`}><div className="table-wrap"><table><thead><tr><th>Sensor ID</th><th>Location</th><th>Type</th><th>Reading</th><th>Battery</th><th>Status</th><th>Updated</th></tr></thead><tbody>{sensors.map(s=><tr key={s.id}><td><b>{s.id}</b></td><td>{s.location}</td><td>{s.type}</td><td>{s.reading}</td><td>{s.battery}%</td><td><span className={'status '+s.status}>{s.status}</span></td><td>{s.updated}</td></tr>)}</tbody></table></div></Panel>
 </PageHead>
}

function Alerts({alerts,sendTest}){
 return <PageHead eyebrow="EARLY WARNING CENTER" title="Alerts & Notifications" sub="Actionable warnings generated from risk thresholds and sensor observations." actions={<Button onClick={sendTest}><Send size={14}/>Send Test Alert</Button>}>
  <div className="alert-summary"><Stat title="Active Alerts" value={alerts.filter(a=>a.status==='active').length} note="Requires attention" danger/><Stat title="Resolved Today" value="12" note="Closed events" good/><Stat title="Communities" value="45" note="Monitored"/></div>
  <div className="alert-list">{alerts.map(a=><div className={'alert-card '+a.severity.toLowerCase()} key={a.id}><b>{a.severity}</b><div><h3>{a.title}</h3><p>{a.message}</p><small>Confidence {a.confidence}% · {a.status}</small></div></div>)}</div>
 </PageHead>
}

function HistoryPage(){
 return <PageHead eyebrow="HISTORICAL ANALYSIS" title="Historical Disaster Data" sub="Use rainfall and previous events to support risk assessment.">
  <div className="two-col"><Panel title="Monthly Rainfall" sub="East Sikkim · mm"><div className="chart tall"><ResponsiveContainer><BarChart data={monthlyData}><CartesianGrid vertical={false} stroke="#edf1f5"/><XAxis dataKey="m" tick={{fontSize:9}}/><YAxis tick={{fontSize:9}}/><Tooltip/><Bar dataKey="v" fill="#4c8fe5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Event History" sub="Recorded events">{[['18 JUL','Flash flood','Teesta basin','HIGH'],['04 JUL','Landslide & road blockage','Ranka','MED'],['29 JUN','Urban flooding','Gangtok','MED'],['11 JUN','River level alert','Teesta','LOW']].map(e=><div className="event" key={e[0]}><b>{e[0]}</b><div><strong>{e[1]}</strong><small>{e[2]}</small></div><em>{e[3]}</em></div>)}</Panel></div>
 </PageHead>
}

function Incidents({incidents,online,reload,notify}){
 const [open,setOpen]=useState(false),[form,setForm]=useState({location:'East Sikkim',incident_type:'Flash flood',description:''})
 async function submit(e){
  e.preventDefault()
  if(!form.description.trim()){notify('Please enter a description');return}
  if(!online){
    const q=JSON.parse(localStorage.getItem('geoguard_queue')||'[]');q.push({...form,source:'Citizen'});localStorage.setItem('geoguard_queue',JSON.stringify(q));setOpen(false);notify('Saved offline. It will sync when connection returns.');return
  }
  try{await api('/incidents',{method:'POST',body:JSON.stringify({...form,source:'Citizen'})});setOpen(false);setForm({...form,description:''});notify('Incident submitted to backend');reload()}catch{notify('Could not submit. Saved offline instead.');const q=JSON.parse(localStorage.getItem('geoguard_queue')||'[]');q.push({...form,source:'Citizen'});localStorage.setItem('geoguard_queue',JSON.stringify(q));setOpen(false)}
 }
 return <PageHead eyebrow="FIELD REPORTING" title="Incident Reports" sub="Citizen and officer reports work even during poor connectivity." actions={<Button onClick={()=>setOpen(true)}>+ Report Incident</Button>}>
  <Panel title="Recent Reports" sub={`${incidents.length} reports loaded from backend`}><div className="table-wrap"><table><thead><tr><th>ID</th><th>Location</th><th>Type</th><th>Description</th><th>Source</th><th>Status</th></tr></thead><tbody>{incidents.length?incidents.map(i=><tr key={i.id}><td>{i.id}</td><td>{i.location}</td><td>{i.incident_type}</td><td>{i.description}</td><td>{i.source}</td><td><span className="status warning">{i.status}</span></td></tr>):<tr><td colSpan="6">No incidents yet.</td></tr>}</tbody></table></div></Panel>
  <div className="offline"><Wifi size={22}/><div><b>Offline-first reporting</b><p>When the backend is unreachable, reports are stored in browser Local Storage and automatically uploaded after the connection returns.</p></div></div>
  {open&&<div className="modal"><form onSubmit={submit}><button type="button" className="close" onClick={()=>setOpen(false)}>×</button><p className="eyebrow">FIELD REPORT</p><h2>Report an Incident</h2><label>Location<select value={form.location} onChange={e=>setForm({...form,location:e.target.value})}><option>East Sikkim</option><option>West Sikkim</option><option>Tawang</option><option>East Khasi Hills</option><option>Kohima</option></select></label><label>Incident Type<select value={form.incident_type} onChange={e=>setForm({...form,incident_type:e.target.value})}><option>Flash flood</option><option>Water level rise</option><option>Road blockage</option><option>Heavy rainfall</option><option>Landslide</option></select></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what you observed..."/></label><div className="form-actions"><Button secondary type="button" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit">Submit Report</Button></div></form></div>}
 </PageHead>
}

function About(){return <PageHead eyebrow="SYSTEM INFORMATION" title="About GeoGuard" sub="Integrated software platform for hyper-local flash flood early warning."><div className="about-grid"><Panel title="What the system does"><p>GeoGuard combines environmental observations, IoT data, historical disaster records and predictive analytics to support earlier, location-specific warnings.</p><div className="features"><b>01 · Multi-source data</b><span>Rainfall, soil moisture, slope, water level and historical events.</span><b>02 · Hyper-local prediction</b><span>Risk assessment at village and ward level.</span><b>03 · Actionable alerts</b><span>Clear warning levels and estimated lead time.</span><b>04 · Offline reporting</b><span>Capture incidents and sync them when connectivity returns.</span></div></Panel><Panel title="Technology Architecture"><div className="tech"><span>React + Vite</span><span>Python + FastAPI</span><span>MongoDB</span><span>IoT Sensors</span><span>Weather APIs</span><span>GIS</span><span>Risk Engine</span><span>Local Storage</span></div><h3>Flow</h3><div className="flow"><b>Data Sources</b>→<b>FastAPI</b>→<b>Risk Engine</b>→<b>Alert</b></div><p className="note">The included risk calculation is a transparent demo model. Connect a trained ML model for production prediction.</p></Panel></div></PageHead>}

function PageHead({eyebrow,title,sub,actions,children}){return <div className="page"><div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{sub}</p></div>{actions&&<div className="actions">{actions}</div>}</div>{children}</div>}
function Panel({title,sub,children}){return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{sub&&<small>{sub}</small>}</div></div>{children}</section>}
function Stat({icon,title,value,note,good,warn,danger}){return <div className="stat"><div className={'stat-icon '+(danger?'danger':warn?'warn':'blue')}>{icon}</div><div><span>{title}</span><strong className={danger?'danger-text':''}>{value}</strong><small className={good?'good':warn?'warn-text':''}>{note}</small></div></div>}
function Warning({a}){return <div className="warning"><i>!</i><div><b>{a.title}</b><p>{a.message}</p><small>{a.severity} · Confidence {a.confidence}%</small></div></div>}
function Button({children,secondary,onClick,disabled,type='button'}){return <button type={type} disabled={disabled} className={secondary?'btn secondary':'btn'} onClick={onClick}>{children}</button>}

createRoot(document.getElementById('root')).render(<App/>)
