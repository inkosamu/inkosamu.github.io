var left = 0;
var timer;
run();
function run(){
      wheel.style.marginLeft = left + "px";
      left -=10;
      timer = setTimeout(run,10);

}