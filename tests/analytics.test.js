import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGuessTracker} from '../src/analytics.js';

const id='550e8400-e29b-41d4-a716-446655440000';
const star={id:'Betelgeuse',name:'Betelgeuse'};
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};

test('player identity survives reloads and resetting discoveries',()=>{
 const storage=memory(),events=[],getCounter=()=>({count:event=>events.push(event)});
 createGuessTracker({storage,getCounter,makeId:()=>id}).recordGuess(star,'incorrect');
 storage.removeItem('starhopper.discovered');
 createGuessTracker({storage,getCounter,makeId:()=>{throw Error('must reuse ID');}}).recordGuess(star,'correct');
 assert.equal(events.length,2);
 assert.ok(events.every(event=>event.path.endsWith(`/player/${id}`)));
 assert.equal(storage.getItem('starhopper.player-id'),id);
});

test('every attempt is counted, including repeats, with only catalogue data',()=>{
 const events=[],tracker=createGuessTracker({storage:memory(),getCounter:()=>({count:event=>events.push(event)}),makeId:()=>id});
 for(const outcome of ['incorrect','incorrect','near-miss','correct'])tracker.recordGuess(star,outcome);
 assert.equal(events.length,4);
 assert.deepEqual(events[0],{path:`starhopper/guess/Betelgeuse/incorrect/player/${id}`,title:`Starhopper · Betelgeuse · incorrect · player ${id}`,event:true,no_session:true,referrer:''});
 tracker.recordGuess({id:'a/b',name:'A/B'},'correct');
 assert.match(events[4].path,/guess\/a%2Fb\/correct/);
 tracker.recordGuess(star,'invalid');
 assert.equal(events.length,5);
});

test('early guesses flush once in order after the async tracker loads',()=>{
 let counter;
 const events=[],tracker=createGuessTracker({getCounter:()=>counter,makeId:()=>id});
 tracker.recordGuess(star,'incorrect');tracker.recordGuess(star,'correct');
 assert.deepEqual(events,[]);
 counter={count:event=>events.push(event)};
 tracker.flush();tracker.flush();
 assert.equal(events.length,2);
 assert.match(events[0].path,/incorrect/);assert.match(events[1].path,/correct/);
});

test('blocked storage uses one identity for the current page',()=>{
 const events=[];let generated=0;
 const tracker=createGuessTracker({storage:{getItem(){throw Error();},setItem(){throw Error();}},getCounter:()=>({count:event=>events.push(event)}),makeId:()=>{generated++;return id;}});
 tracker.recordGuess(star,'incorrect');tracker.recordGuess(star,'correct');
 assert.equal(generated,1);assert.equal(events.length,2);
});

test('corrupted saved IDs are replaced rather than sent',()=>{
 const storage=memory(),events=[];
 storage.setItem('starhopper.player-id','someone@example.com');
 createGuessTracker({storage,getCounter:()=>({count:event=>events.push(event)}),makeId:()=>id}).recordGuess(star,'correct');
 assert.equal(storage.getItem('starhopper.player-id'),id);
 assert.ok(!JSON.stringify(events).includes('someone@example.com'));
});

test('blocked trackers have bounded queues and failures never break gameplay',()=>{
 let counter;
 const events=[],tracker=createGuessTracker({getCounter:()=>counter,makeId:()=>id});
 for(let i=0;i<150;i++)tracker.recordGuess(star,'incorrect');
 counter={count:event=>events.push(event)};tracker.flush();assert.equal(events.length,100);
 counter={count(){throw Error('blocked');}};
 assert.doesNotThrow(()=>tracker.recordGuess(star,'correct'));
 counter={count:event=>events.push(event)};tracker.flush();assert.equal(events.length,100);
 assert.doesNotThrow(()=>createGuessTracker({getCounter:()=>counter,makeId:()=>{throw Error('no crypto');}}).recordGuess(star,'correct'));
});
