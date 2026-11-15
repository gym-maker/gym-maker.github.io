/* Shared year-calendar engine. Pure client-side. */
(function(){
function pad(n){return n<10?'0'+n:''+n}
function key(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
window.YearCal=function(o){
  var Y=o.year,H=o.holidays,L=o.labels;
  var start=new Date(Y,0,1),end=new Date(Y,11,31);
  // day list with a margin of 10 days each side so bridges at year edges work
  var days=[];for(var d=addDays(start,-10);d<=addDays(end,10);d=addDays(d,1)){
    var k=key(d),wd=d.getDay(),ext=(o.extra||{})[k];
    var hol=H[k]||ext||null;days.push({d:d,k:k,wd:wd,hol:hol,off:(wd===0||wd===6||!!hol),inYear:d.getFullYear()===Y});}
  function isOff(i){return days[i].off}
  // stats
  var st={holidays:0,weekdayHol:0,offDays:0,workDays:0};
  days.forEach(function(x){if(!x.inYear)return;if(H[x.k])st.holidays++;if(H[x.k]&&x.wd>0&&x.wd<6)st.weekdayHol++;if(x.off)st.offDays++;else st.workDays++;});
  // long weekends: maximal runs of off days >=3 with at least one holiday
  var runs=[];for(var i=0;i<days.length;){if(!isOff(i)){i++;continue}var j=i;while(j+1<days.length&&isOff(j+1))j++;
    var len=j-i+1,hasH=false;for(var t=i;t<=j;t++)if(days[t].hol)hasH=true;
    if(len>=3&&hasH&&(days[i].inYear||days[j].inYear))runs.push({a:i,b:j,len:len});i=j+1;}
  // leave plans: windows containing k (1..maxLeave) workdays, maximal (bounded by workdays), must contain a holiday
  var plans=[],maxLeave=o.maxLeave||4;
  for(var a=1;a<days.length-1;a++){
    if(isOff(a-1))continue;
    for(var b=a;b<days.length-1;b++){
      if(isOff(b+1))continue;
      var k=0,h=false,leave=[];for(var t=a;t<=b;t++){if(!isOff(t)){k++;leave.push(t)}if(days[t].hol)h=true}
      if(k>maxLeave)break;
      if(k>=1&&h){var len=b-a+1;if(len>=k+3&&days[leave[0]].inYear)plans.push({a:a,b:b,len:len,k:k,leave:leave,eff:len/k});}
    }
  }
  // per leave count k: greedy non-overlapping windows, longest first
  var byK={};for(var kk=1;kk<=maxLeave;kk++){var list=plans.filter(function(p){return p.k===kk}).sort(function(p,q){return q.len-p.len||p.a-q.a});
    var used={},keep=[];list.forEach(function(p){for(var t=p.a;t<=p.b;t++)if(used[t])return;keep.push(p);for(var t2=p.a;t2<=p.b;t2++)used[t2]=1});
    byK[kk]=keep.slice(0,o.perK||4).sort(function(p,q){return p.a-q.a});}
  var best=byK;
  return {days:days,stats:st,runs:runs,plans:best,fmt:function(i){return o.fmtDate(days[i].d)},
    render:function(el,leaveSet){
      leaveSet=leaveSet||{};var html='',idx={};days.forEach(function(x,i){idx[x.k]=i});
      for(var m=0;m<12;m++){
        var first=new Date(Y,m,1),n=new Date(Y,m+1,0).getDate(),names=[];
        html+='<div class="month"><h3>'+L.months[m]+'</h3><div class="grid">';
        L.dow.forEach(function(w,wi){html+='<div class="dow'+(wi===0?' sun':wi===6?' sat':'')+'">'+w+'</div>'});
        for(var e=0;e<first.getDay();e++)html+='<div></div>';
        for(var dd=1;dd<=n;dd++){var dt=new Date(Y,m,dd),k=key(dt),x=days[idx[k]],c='d';
          if(x.wd===0)c+=' sun';else if(x.wd===6)c+=' sat';if(x.hol){c+=' hol';names.push(dd+L.daySuffix+' '+x.hol)}
          if(leaveSet[k])c+=' leave';if(k===key(new Date()))c+=' today';
          html+='<div class="'+c+'"'+(x.hol?' title="'+x.hol+'"':'')+'>'+dd+'</div>';}
        html+='</div><div class="hnames">'+names.join(' · ')+'</div></div>';}
      el.innerHTML=html;}
  };
};
})();
