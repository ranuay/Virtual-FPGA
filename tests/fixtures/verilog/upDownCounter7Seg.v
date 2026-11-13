// Press KEY0 to count up and KEY1 to count down; the digit wraps 0..9.
// The count is shown on HEX0_N; the other displays stay blank.
// CLOCK_500Hz is provided by HDLBoard: one press is one step at that rate.
module upDownCounter7Seg (
    input  wire        CLOCK_500Hz,
    input  wire [3:0]  KEY_N,
    output wire [6:0]  HEX0_N,
    output wire [6:0]  HEX1_N,
    output wire [6:0]  HEX2_N,
    output wire [6:0]  HEX3_N,
    output wire [6:0]  HEX4_N,
    output wire [6:0]  HEX5_N
);
    // One digit (0..9) to its segments, active low: bit 0 is segment a,
    // bit 6 is segment g, and 0 lights a segment.
    function [6:0] to_segments(input [3:0] digit);
        case (digit)
            4'd0: to_segments = 7'b1000000;
            4'd1: to_segments = 7'b1111001;
            4'd2: to_segments = 7'b0100100;
            4'd3: to_segments = 7'b0110000;
            4'd4: to_segments = 7'b0011001;
            4'd5: to_segments = 7'b0010010;
            4'd6: to_segments = 7'b0000010;
            4'd7: to_segments = 7'b1111000;
            4'd8: to_segments = 7'b0000000;
            4'd9: to_segments = 7'b0010000;
            default: to_segments = 7'b1111111;
        endcase
    endfunction

    reg [3:0] count = 4'd0;
    // The keys as they were on the previous clock edge: a press is the edge
    // where a key goes from released (1) to pressed (0).
    reg [1:0] key_prev = 2'b11;

    always @(posedge CLOCK_500Hz) begin
        key_prev <= KEY_N;

        if (key_prev[0] && !KEY_N[0]) begin             // KEY0: count up
            count <= (count == 4'd9) ? 4'd0 : count + 4'd1;
        end else if (key_prev[1] && !KEY_N[1]) begin    // KEY1: count down
            count <= (count == 4'd0) ? 4'd9 : count - 4'd1;
        end
    end

    assign HEX0_N = to_segments(count);

    // Unused displays: all segments off (active low).
    assign HEX1_N = 7'b1111111;
    assign HEX2_N = 7'b1111111;
    assign HEX3_N = 7'b1111111;
    assign HEX4_N = 7'b1111111;
    assign HEX5_N = 7'b1111111;
endmodule
