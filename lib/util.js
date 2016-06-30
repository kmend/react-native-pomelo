'use strict';
/**
 * Created by 陈桥 on 2016/6/30.
 * QQ:626164558
 * Email ：chen.qiao@foxmail.com
 */
var util = module.exports;

util.isSimpleType = function(type){
	return ( type === 'uInt32' ||
					 type === 'sInt32' ||
					 type === 'int32'  ||
					 type === 'uInt64' ||
					 type === 'sInt64' ||
					 type === 'float'  ||
					 type === 'double');
};

util.equal = function(obj0, obj1){
	for(var key in obj0){
		var m = obj0[key];
		var n = obj1[key];

		if(typeof(m) === 'object'){
			if(!util.equal(m, n)){
				return false;
			}
		}else if(m !== n){
			return false;
		}
	}

	return true;
};