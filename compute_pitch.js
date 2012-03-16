/* 
  Computes Pitch from the frame of raw sampels
  
  Project: https://github.com/digish/pitch-detect-javascript
 
  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

 */

var pd = function () {

  var c = {
    samplerate                    :11025, /* Default rate */
    threshold_of_input_signal     :0.1,   /* Default threshold */
    correlation_frame_window_size :512,  
    buffers: {
      buf:[],
      max:[],
      storage_count:2,
    },
    state : {
      correlation_frame:[],
      pitch_frame:[],
      peaks_frame:[],
      valid_peaks_frame:[],
    },  
  }

  /*** Private routines ****/
  // internal cleanup routine
  var clear_state_data = function () {
    c.state.pitch_frame = [];
    c.state.peaks_frame = [];  
    c.state.correlation_frame = [];
    c.state.valid_peaks_frame = [];
  }

  // calculates correlation of frame
  var compute_correlation_frame = function () {

    var wave_state  = 0; // none
    var priv_corr   = 0;
    var max_corr    = 0;
    var float_buffer = c.buffers.buf.pop();
    var float_buffer_max = c.buffers.max.pop();
  
    if (float_buffer_max < c.threshold_of_input_signal) 
      {
	return;
      }
  
    for (var i = 0 ; i < float_buffer.length; ++i) {
      var corr = 0.0;
      // corelation
      for (var n = 0 ; n < float_buffer.length - i - 1; ++n) {
	corr = corr + ((float_buffer[n]) * (float_buffer[n+i]));
      }
      if (corr > max_corr) {
	max_corr = corr
      }
      // detect peaks 
      // check if wave pattern is climbing ?
      if (corr > priv_corr) {
	wave_state = 1; // climbing
      } else {
	// we are declining
	// if we were climbing before we were on peak
	if (wave_state == 1) {
	  // we found a peak so register it.
	  if (priv_corr > 0) {
	    c.state.peaks_frame.push([i-1, priv_corr]);
	  }
	  // update the state to declining
	  wave_state = -1;
	}
      }
      priv_corr = corr;
      c.state.correlation_frame.push([i, priv_corr]);
    }
  
    // normalize the correlation output
    for (var i=0; i < c.state.correlation_frame.length; i++) {
      c.state.correlation_frame[i][1] = c.state.correlation_frame[i][1]/ max_corr;
    };
  
    // normalize peaks as well
    for (var i=0; i < c.state.peaks_frame.length; i++) {
      c.state.peaks_frame[i][1] = c.state.peaks_frame[i][1]/max_corr;
    };
  }

  var config = function (cmd,val) {
    if (cmd == "samplerate") {
      c.samplerate = val;
    }
    else if (cmd == "threshold") {
      c.threshold_of_input_signal = val;
    }
    else if (cmd == "window_size") {
      c.correlation_frame_window_size = val;
    }
  }

  var in_data_txt = function (buf)
  {
    if (c.buffers.buf.length < c.buffers.storage_count) 
    {
      var float_buffer = [];
      slot = (buf).split(';');
      var max_sample = 0;
      for (var i = 0 ; (i < slot.length) && (i <= c.correlation_frame_window_size) ; ++i) {
        float_buffer[i] = parseFloat(slot[i]);
        if (float_buffer[i] > max_sample) {
          max_sample = float_buffer[i];
        }
      }
      c.buffers.buf.push(float_buffer);
      c.buffers.max.push(max_sample);
    }
  };


  var in_data_num = function (buf)
  {
    if (c.buffers.buf.length < c.buffers.storage_count) 
    {
      var float_buffer = [];
      var max_sample = 0;
      for (var i = 0 ; (i < buf.length) && (i <= c.correlation_frame_window_size) ; ++i) {
        float_buffer[i] = buf[i];
        if (float_buffer[i] > max_sample) {
          max_sample = float_buffer[i];
        }
      }
      c.buffers.buf.push(float_buffer);
      c.buffers.max.push(max_sample);
    }
  };

  // calculates pitch on frame
  var compute_pitch = function () {
    // clear the state data
    clear_state_data();
    // compute the correlation first on current frames 
    compute_correlation_frame();
    
    
    var active_pitch_index = 0;
    var first_peak_id      = [0];
    var second_peak_id     = [0];
    var valid              = false;
    var peak_diff_counter  = 0;
    
    if (c.state.peaks_frame.length > 2) {
      min_diff = 99999;
      for (var i = 1; i < c.state.peaks_frame.length-1; i++ ) {
        diff = (c.state.peaks_frame[0][1] - c.state.peaks_frame[i][1]);
        if (diff < min_diff) {
          min_diff = diff;
          second_peak_id[active_pitch_index] = i;
          peak_diff_counter = i;
        }
      }
      pitch = c.samplerate / c.state.peaks_frame[second_peak_id[active_pitch_index]][0] - c.state.peaks_frame[first_peak_id[active_pitch_index]][0];
      c.state.pitch_frame.push(pitch);
      c.state.valid_peaks_frame.push([0,c.state.peaks_frame[0][1]]);
      c.state.valid_peaks_frame.push([c.state.peaks_frame[second_peak_id[active_pitch_index]][0], c.state.peaks_frame[second_peak_id[active_pitch_index]][1]]);
      valid = true;
    }

    
    return {
      valid          :valid,
      pitch          :c.state.pitch_frame,
      correlation    :c.state.correlation_frame,
      peaks          :c.state.peaks_frame,
      matching_peaks :c.state.valid_peaks_frame,
    };
  }

  var get_pending_data_size = function () {
    return c.buffers.buf.length;
  }
  
  /* pubic routines */
  return {
    config: config,
    in_data_num:in_data_num,
    in_data_txt:in_data_txt,
    compute_pitch:compute_pitch,
    get_pending_data_size:get_pending_data_size,
  }  

}();
