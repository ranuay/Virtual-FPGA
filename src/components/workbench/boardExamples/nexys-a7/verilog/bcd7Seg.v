// The number on SW[3:0] is shown as one digit on digit 0; SW[15:4] are not
// used. 0..9 show the digit and 10..15 leave the display blank.
module bcd7Seg (
    input  wire [15:0] SW,
    output wire        CA, CB, CC, CD, CE, CF, CG,
    output wire        DP,
    output wire [7:0]  AN
);
    // Segment bits are gfedcba; a zero lights a segment.
    reg [6:0] segments;

    always @* begin
        case (SW[3:0])
            4'd0: segments = 7'b1000000;
            4'd1: segments = 7'b1111001;
            4'd2: segments = 7'b0100100;
            4'd3: segments = 7'b0110000;
            4'd4: segments = 7'b0011001;
            4'd5: segments = 7'b0010010;
            4'd6: segments = 7'b0000010;
            4'd7: segments = 7'b1111000;
            4'd8: segments = 7'b0000000;
            4'd9: segments = 7'b0010000;
            default: segments = 7'b1111111;   // 10..15: blank
        endcase
    end

    assign {CG, CF, CE, CD, CC, CB, CA} = segments;
    assign DP = 1'b1;                  // Decimal point off (active low).
    assign AN = 8'b11111110;           // Digit 0 only; the rest stay dark.
endmodule
