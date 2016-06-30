'use strict';
/**
 * Created by 陈桥 on 2016/6/30.
 * QQ:626164558
 * Email ：chen.qiao@foxmail.com
 */

export default {
    EVENTS:{},
    on : function( evt, listener )  {
        this.EVENTS[evt] = this.EVENTS[evt] || [];
        this.EVENTS[evt].push(listener);
    },
    emit: function(evt, val) {
        this.EVENTS[evt] && this.EVENTS[evt].forEach((fcb)=>{
            fcb(val);
        });
    }
};

